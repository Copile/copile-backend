require("dotenv").config();
const express = require("express");
const { Connection, PublicKey } = require("@solana/web3.js");
const { JitoRpcClient } = require("@jito-labs/jito-ts");
const admin = require("firebase-admin");
const winston = require("winston");
const WebSocket = require("ws");
const NodeCache = require("node-cache");
const { GeyserClient, SearcherClient } = require("jito-ts/dist/sdk");
const { Firestore } = require("@google-cloud/firestore");
const { PubSub } = require("@google-cloud/pubsub");
const { Helius } = require("helius-sdk");

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000;

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

// Initialize Helius client for enhanced data
const helius = new Helius(process.env.HELIUS_API_KEY);

// Initialize Jito clients
const geyserClient = new GeyserClient(process.env.JITO_GEYSER_URL);
const searcherClient = new SearcherClient(process.env.JITO_SEARCHER_URL);

// Known DEX program IDs
const DEX_PROGRAMS = {
  SERUM: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
  RAYDIUM: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
  JUPITER: "JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB",
  ORCA: "9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP",
};

// Mempool state
let mempoolTransactions = new Map();
let wsConnection = null;

// Cache of recent transactions for pattern detection
const recentTxs = new Map();

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
  const transactions = block.transactions || [];

  for (const tx of transactions) {
    const signature = tx.transaction.signatures[0];
    const programIds = tx.transaction.message.accountKeys.map((key) => key.toString());

    // Look for DEX transactions
    const isDexTx = programIds.some((id) => Object.values(DEX_PROGRAMS).includes(id));

    if (isDexTx) {
      mempoolTransactions.set(signature, {
        signature,
        timestamp: new Date().toISOString(),
        programIds,
        blockHeight: block.parentSlot,
        type: "dex",
      });

      // Store in Firebase for persistence
      await admin.firestore().collection("mempool-transactions").doc(signature).set({
        signature,
        timestamp: new Date(),
        programIds,
        blockHeight: block.parentSlot,
        type: "dex",
      });
    }
  }

  // Clean up old transactions
  const now = Date.now();
  for (const [sig, tx] of mempoolTransactions) {
    if (now - new Date(tx.timestamp).getTime() > 300000) {
      // 5 minutes
      mempoolTransactions.delete(sig);
    }
  }
}

// API endpoints
app.get("/mempool/stats", (req, res) => {
  const stats = {
    totalTransactions: mempoolTransactions.size,
    dexBreakdown: {
      serum: 0,
      raydium: 0,
      jupiter: 0,
    },
    timestamp: new Date().toISOString(),
  };

  for (const tx of mempoolTransactions.values()) {
    tx.programIds.forEach((id) => {
      if (id === DEX_PROGRAMS.SERUM) stats.dexBreakdown.serum++;
      if (id === DEX_PROGRAMS.RAYDIUM) stats.dexBreakdown.raydium++;
      if (id === DEX_PROGRAMS.JUPITER) stats.dexBreakdown.jupiter++;
    });
  }

  res.json(stats);
});

app.get("/mempool/transactions", (req, res) => {
  const { limit = 100, type } = req.query;
  let transactions = Array.from(mempoolTransactions.values());

  if (type) {
    transactions = transactions.filter((tx) => tx.type === type);
  }

  res.json({
    transactions: transactions.slice(0, limit),
    total: transactions.length,
  });
});

async function analyzePendingTransaction(tx) {
  try {
    // Get enhanced transaction data from Helius
    const enrichedTx = await helius.getEnrichedTransaction(tx.signature);
    if (!enrichedTx) return;

    // Check if transaction involves DEX programs
    const dexInteractions = enrichedTx.instructions.filter((ix) =>
      Object.values(DEX_PROGRAMS).includes(ix.programId)
    );

    if (dexInteractions.length === 0) return;

    // Extract transaction information
    const txInfo = {
      signature: tx.signature,
      instructions: enrichedTx.instructions,
      tokenTransfers: enrichedTx.tokenTransfers,
      accounts: enrichedTx.accountKeys.map((a) => a.toString()),
      computeUnits: enrichedTx.computeUnits,
      fee: enrichedTx.fee,
      timestamp: Date.now(),
    };

    // Store transaction in recent cache
    recentTxs.set(tx.signature, txInfo);

    // Clean up old transactions (older than 30 seconds)
    const thirtySecondsAgo = Date.now() - 30 * 1000;
    for (const [sig, tx] of recentTxs.entries()) {
      if (tx.timestamp < thirtySecondsAgo) {
        recentTxs.delete(sig);
      }
    }

    // Analyze for MEV opportunities
    const opportunities = await analyzeMEVOpportunities(txInfo);
    if (opportunities.length > 0) {
      txInfo.opportunities = opportunities;

      // Store opportunity information
      await firestore.collection("mev_opportunities").add({
        ...txInfo,
        timestamp: new Date(),
      });

      // Publish opportunity for potential action
      await topic.publish(
        Buffer.from(
          JSON.stringify({
            type: "mev_opportunity",
            data: txInfo,
          })
        )
      );

      console.log(`Found MEV opportunities in tx ${tx.signature}: ${opportunities.join(", ")}`);
    }
  } catch (error) {
    console.error("Failed to analyze pending transaction:", error);
  }
}

async function analyzeMEVOpportunities(tx) {
  const opportunities = [];

  // Look for large trades that could be sandwiched
  if (tx.tokenTransfers.some((t) => t.amount > 10000)) {
    opportunities.push("sandwich_target");
  }

  // Look for arbitrage opportunities across DEXes
  const recentTxsArray = Array.from(recentTxs.values());
  const sameTokenTxs = recentTxsArray.filter((t) =>
    t.tokenTransfers.some((tt) => tx.tokenTransfers.some((currentTt) => currentTt.mint === tt.mint))
  );

  if (sameTokenTxs.length > 2) {
    opportunities.push("cross_dex_arb");
  }

  // Look for liquidation opportunities
  if (tx.instructions.some((ix) => ix.data.includes("liquidate"))) {
    opportunities.push("liquidation");
  }

  return opportunities;
}

async function submitMEVBundle(transactions) {
  try {
    // Build bundle with tip-paying transaction
    const bundle = {
      transactions,
      header: {
        tip: calculateOptimalTip(transactions),
        targetSlot: (await connection.getSlot()) + 1,
      },
    };

    // Submit bundle to Jito
    const result = await searcherClient.submitBundle(bundle);
    console.log(`Submitted MEV bundle: ${result.bundleId}`);

    return result;
  } catch (error) {
    console.error("Failed to submit MEV bundle:", error);
    throw error;
  }
}

function calculateOptimalTip(transactions) {
  // Implementation would calculate optimal tip based on:
  // - Expected profit from transactions
  // - Current network congestion
  // - Competition from other searchers
  return 100000; // Placeholder value in lamports
}

async function main() {
  // Subscribe to Jito Geyser for real-time mempool data
  await geyserClient.subscribeMempool(
    {
      commitment: "processed",
      accounts: Object.values(DEX_PROGRAMS).map((id) => new PublicKey(id)),
      votePubkey: null,
      includeTransactions: true,
      includeAccounts: true,
      includeEntries: false,
    },
    {
      onTransaction: async (tx) => {
        await analyzePendingTransaction(tx);
      },
      onError: (error) => {
        console.error("Geyser subscription error:", error);
      },
    }
  );

  console.log("Started monitoring Solana mempool");
}

main().catch(console.error);

// Start the server
app.listen(port, () => {
  logger.info(`Mempool monitor started on port ${port}`);
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
