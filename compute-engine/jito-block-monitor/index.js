require("dotenv").config();
const express = require("express");
const { Connection, PublicKey } = require("@solana/web3.js");
const { JitoRpcClient } = require("@jito-labs/jito-ts");
const admin = require("firebase-admin");
const winston = require("winston");
const WebSocket = require("ws");
const NodeCache = require("node-cache");
const { GeyserClient } = require("jito-ts/dist/sdk");
const { BundleClient } = require("jito-ts/dist/sdk");
const { Firestore } = require("@google-cloud/firestore");
const { PubSub } = require("@google-cloud/pubsub");

// Initialize Express app
const app = express();
const port = process.env.PORT || 3001;

// Initialize Firebase
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

// Initialize cache
const cache = new NodeCache({ stdTTL: 60 }); // 1 minute cache

// Configure logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
    new winston.transports.Console(),
  ],
});

// Initialize Solana connection
const connection = new Connection(process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com");
const jitoClient = new JitoRpcClient(process.env.JITO_RPC_URL || "https://jito-api.mainnet-beta.solana.com");

// Initialize clients
const firestore = new Firestore();
const pubsub = new PubSub();
const topic = pubsub.topic(process.env.PUBSUB_TOPIC);

// Initialize Jito clients
const geyserClient = new GeyserClient(process.env.JITO_GEYSER_URL);
const bundleClient = new BundleClient(process.env.JITO_BUNDLE_URL);

// Block monitoring state
let blockStats = {
  totalBlocks: 0,
  jitoBlocks: 0,
  mevOpportunities: 0,
  recentBlocks: [],
  lastUpdate: null,
};

let wsConnection = null;

// Cache of wallets we're tracking
let trackedWallets = new Set();

async function updateTrackedWallets() {
  try {
    const snapshot = await firestore.collection("tracked_wallets").get();
    const wallets = new Set();
    snapshot.forEach((doc) => {
      wallets.add(new PublicKey(doc.data().address));
    });
    trackedWallets = wallets;
    console.log(`Updated tracked wallets: ${wallets.size} wallets`);
  } catch (error) {
    console.error("Failed to update tracked wallets:", error);
  }
}

async function handleTransaction(tx, slot, blockTime) {
  try {
    // Check if transaction involves any tracked wallets
    const accounts = tx.message.accountKeys;
    const trackedAccounts = accounts.filter((account) => trackedWallets.has(account.toString()));

    if (trackedAccounts.length === 0) return;

    // Decode and analyze the transaction
    const decodedTx = await connection.getParsedTransaction(tx.signature, "confirmed");
    if (!decodedTx) return;

    // Extract relevant trade information
    const tradeInfo = {
      signature: tx.signature,
      slot,
      blockTime,
      trader: trackedAccounts[0].toString(),
      instructions: decodedTx.transaction.message.instructions,
      accounts: accounts.map((a) => a.toString()),
      programIds: decodedTx.transaction.message.instructions.map((ix) => ix.programId.toString()),
    };

    // Store trade information
    await firestore.collection("trades").add({
      ...tradeInfo,
      timestamp: new Date(blockTime * 1000),
    });

    // Publish trade for copy execution
    await topic.publish(
      Buffer.from(
        JSON.stringify({
          type: "new_trade",
          data: tradeInfo,
        })
      )
    );

    console.log(`Processed trade from ${tradeInfo.trader} in slot ${slot}`);
  } catch (error) {
    console.error("Failed to handle transaction:", error);
  }
}

async function main() {
  // Initial load of tracked wallets
  await updateTrackedWallets();

  // Watch for changes to tracked wallets
  firestore.collection("tracked_wallets").onSnapshot(() => updateTrackedWallets());

  // Subscribe to Jito Geyser for real-time block data
  await geyserClient.subscribeBlocksAndTxs(
    {
      commitment: "processed",
      accounts: Array.from(trackedWallets),
      votePubkey: null,
      includeTransactions: true,
      includeAccounts: true,
      includeEntries: false,
    },
    {
      onBlock: async (block) => {
        for (const tx of block.transactions) {
          await handleTransaction(tx, block.slot, block.blockTime);
        }
      },
      onError: (error) => {
        console.error("Geyser subscription error:", error);
      },
    }
  );

  console.log("Started monitoring Jito blocks for trades");
}

main().catch(console.error);

// Connect to Jito WebSocket
const connectToJitoWs = () => {
  if (wsConnection) return;

  wsConnection = new WebSocket("wss://jito-block-engine.mainnet-beta.solana.com");

  wsConnection.on("open", () => {
    logger.info("Connected to Jito block engine");
    wsConnection.send(
      JSON.stringify({
        jsonrpc: "2.0",
        method: "blockSubscribe",
        params: ["all"],
        id: 1,
      })
    );
  });

  wsConnection.on("message", async (data) => {
    try {
      const block = JSON.parse(data);
      if (block.result && block.result.value) {
        await processBlock(block.result.value);
      }
    } catch (error) {
      logger.error("Error processing block:", error);
    }
  });

  wsConnection.on("close", () => {
    logger.warn("Disconnected from Jito block engine");
    wsConnection = null;
    setTimeout(connectToJitoWs, 5000);
  });
};

// Process incoming blocks
async function processBlock(block) {
  blockStats.totalBlocks++;

  const blockInfo = {
    slot: block.parentSlot,
    timestamp: new Date().toISOString(),
    transactions: block.transactions?.length || 0,
    isJitoBlock: false,
    mevOpportunities: 0,
  };

  // Check if it's a Jito block
  const blockProduction = await jitoClient.getRecentBlockProduction();
  if (blockProduction && blockProduction.jitoBlocks > 0) {
    blockStats.jitoBlocks++;
    blockInfo.isJitoBlock = true;
  }

  // Analyze transactions for MEV opportunities
  if (block.transactions) {
    for (const tx of block.transactions) {
      const programIds = tx.transaction.message.accountKeys.map((key) => key.toString());

      // Look for specific MEV patterns (e.g., sandwich attacks)
      const potentialMev = analyzeMevPattern(tx, programIds);
      if (potentialMev) {
        blockStats.mevOpportunities++;
        blockInfo.mevOpportunities++;
      }
    }
  }

  // Update recent blocks
  blockStats.recentBlocks.unshift(blockInfo);
  if (blockStats.recentBlocks.length > 100) {
    blockStats.recentBlocks.pop();
  }

  blockStats.lastUpdate = new Date().toISOString();

  // Store block info in Firebase
  await admin.firestore().collection("jito-blocks").doc(block.parentSlot.toString()).set(blockInfo);
}

// Analyze transaction for MEV patterns
function analyzeMevPattern(tx, programIds) {
  // Look for sandwich attack pattern
  const swapInstructions = tx.transaction.message.instructions.filter(
    (ix) =>
      ix.programId === "JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB" || // Jupiter
      ix.programId === "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8" // Raydium
  );

  if (swapInstructions.length >= 2) {
    return true;
  }

  // Look for arbitrage pattern
  const uniqueDexs = new Set(
    programIds.filter(
      (id) =>
        id === "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin" || // Serum
        id === "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8" || // Raydium
        id === "JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB" // Jupiter
    )
  );

  return uniqueDexs.size >= 2;
}

// API endpoints
app.get("/blocks/stats", (req, res) => {
  res.json({
    success: true,
    stats: {
      ...blockStats,
      recentBlocks: blockStats.recentBlocks.slice(0, 10), // Only return last 10 blocks
    },
  });
});

app.get("/blocks/mev", (req, res) => {
  const mevBlocks = blockStats.recentBlocks.filter((block) => block.mevOpportunities > 0);
  res.json({
    success: true,
    totalMevOpportunities: blockStats.mevOpportunities,
    mevBlocks,
  });
});

app.get("/blocks/jito", (req, res) => {
  const jitoBlocks = blockStats.recentBlocks.filter((block) => block.isJitoBlock);
  res.json({
    success: true,
    totalJitoBlocks: blockStats.jitoBlocks,
    jitoBlocks,
  });
});

// Start the server
app.listen(port, () => {
  logger.info(`Jito block monitor started on port ${port}`);
  connectToJitoWs();
});

// Handle graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received. Shutting down...");
  if (wsConnection) {
    wsConnection.close();
  }
  process.exit(0);
});
