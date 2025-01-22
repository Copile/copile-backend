require("dotenv").config();
const express = require("express");
const { Connection, PublicKey } = require("@solana/web3.js");
const { Market } = require("@project-serum/serum");
const { JitoRpcClient } = require("@jito-labs/jito-ts");
const admin = require("firebase-admin");
const winston = require("winston");
const WebSocket = require("ws");
const NodeCache = require("node-cache");
const Decimal = require("decimal.js");
const { GeyserClient } = require("jito-ts/dist/sdk");
const { Firestore } = require("@google-cloud/firestore");
const { PubSub } = require("@google-cloud/pubsub");
const { Helius } = require("helius-sdk");

// Initialize Express app
const app = express();
const port = process.env.PORT || 3003;

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

// Initialize clients
const firestore = new Firestore();
const pubsub = new PubSub();
const topic = pubsub.topic(process.env.PUBSUB_TOPIC);

// Initialize Helius client for enhanced transaction data
const helius = new Helius(process.env.HELIUS_API_KEY);

// Initialize Jito client
const geyserClient = new GeyserClient(process.env.JITO_GEYSER_URL);

// Initialize Solana connection
const connection = new Connection(process.env.JITO_RPC_URL);

// Known DEX program IDs
const DEX_PROGRAMS = {
  SERUM: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
  RAYDIUM: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
  JUPITER: "JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB",
  ORCA: "9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP",
};

// Orderflow state
let orderflowState = {
  recentOrders: [],
  volumeStats: {
    total: new Decimal(0),
    byDex: {
      serum: new Decimal(0),
      raydium: new Decimal(0),
      jupiter: new Decimal(0),
    },
  },
  whales: new Map(), // Track large traders
  patterns: [], // Track trading patterns
  lastUpdate: null,
};

let wsConnection = null;

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
  if (!block.transactions) return;

  for (const tx of block.transactions) {
    const signature = tx.transaction.signatures[0];
    const programIds = tx.transaction.message.accountKeys.map((key) => key.toString());

    // Look for DEX transactions
    const dexPrograms = programIds.filter((id) => Object.values(DEX_PROGRAMS).includes(id));
    if (dexPrograms.length === 0) continue;

    // Calculate transaction volume
    const volume = new Decimal(Math.abs(tx.meta.preBalances[0] - tx.meta.postBalances[0]));

    // Update volume stats
    orderflowState.volumeStats.total = orderflowState.volumeStats.total.plus(volume);

    // Update DEX-specific volumes
    dexPrograms.forEach((program) => {
      if (program === DEX_PROGRAMS.SERUM) {
        orderflowState.volumeStats.byDex.serum = orderflowState.volumeStats.byDex.serum.plus(volume);
      } else if (program === DEX_PROGRAMS.RAYDIUM) {
        orderflowState.volumeStats.byDex.raydium = orderflowState.volumeStats.byDex.raydium.plus(volume);
      } else if (program === DEX_PROGRAMS.JUPITER) {
        orderflowState.volumeStats.byDex.jupiter = orderflowState.volumeStats.byDex.jupiter.plus(volume);
      }
    });

    // Track whale activity (transactions over 1000 SOL)
    if (volume.gt(1000)) {
      const trader = tx.transaction.message.accountKeys[0].toString();
      const whaleInfo = orderflowState.whales.get(trader) || {
        address: trader,
        totalVolume: new Decimal(0),
        tradeCount: 0,
        lastSeen: null,
      };

      whaleInfo.totalVolume = whaleInfo.totalVolume.plus(volume);
      whaleInfo.tradeCount++;
      whaleInfo.lastSeen = new Date().toISOString();

      orderflowState.whales.set(trader, whaleInfo);
    }

    // Add to recent orders
    const orderInfo = {
      signature,
      timestamp: new Date().toISOString(),
      volume: volume.toString(),
      programs: dexPrograms,
      trader: tx.transaction.message.accountKeys[0].toString(),
    };

    orderflowState.recentOrders.unshift(orderInfo);
    if (orderflowState.recentOrders.length > 1000) {
      orderflowState.recentOrders.pop();
    }

    // Store in Firebase
    await admin.firestore().collection("orderflow").doc(signature).set(orderInfo);
  }

  // Update patterns
  analyzePatterns();
  orderflowState.lastUpdate = new Date().toISOString();
}

// Analyze trading patterns
function analyzePatterns() {
  const patterns = [];
  const timeWindows = [5, 15, 30]; // minutes

  timeWindows.forEach((window) => {
    const windowMs = window * 60 * 1000;
    const windowOrders = orderflowState.recentOrders.filter(
      (order) => Date.now() - new Date(order.timestamp).getTime() < windowMs
    );

    if (windowOrders.length === 0) return;

    const volume = windowOrders.reduce((acc, order) => acc.plus(new Decimal(order.volume)), new Decimal(0));

    patterns.push({
      timeWindow: window,
      orderCount: windowOrders.length,
      volume: volume.toString(),
      averageSize: volume.div(windowOrders.length).toString(),
      timestamp: new Date().toISOString(),
    });
  });

  orderflowState.patterns = patterns;
}

// API endpoints
app.get("/orderflow/stats", (req, res) => {
  res.json({
    success: true,
    lastUpdate: orderflowState.lastUpdate,
    volumeStats: {
      total: orderflowState.volumeStats.total.toString(),
      byDex: {
        serum: orderflowState.volumeStats.byDex.serum.toString(),
        raydium: orderflowState.volumeStats.byDex.raydium.toString(),
        jupiter: orderflowState.volumeStats.byDex.jupiter.toString(),
      },
    },
    patterns: orderflowState.patterns,
  });
});

app.get("/orderflow/whales", (req, res) => {
  const whales = Array.from(orderflowState.whales.values()).sort((a, b) =>
    new Decimal(b.totalVolume).minus(a.totalVolume)
  );

  res.json({
    success: true,
    whales: whales.map((whale) => ({
      ...whale,
      totalVolume: whale.totalVolume.toString(),
    })),
  });
});

app.get("/orderflow/recent", (req, res) => {
  const { limit = 100 } = req.query;
  res.json({
    success: true,
    orders: orderflowState.recentOrders.slice(0, limit),
  });
});

// Start the server
app.listen(port, () => {
  logger.info(`Orderflow monitor started on port ${port}`);
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

// Cache of recent trades for pattern detection
const recentTrades = new Map();

async function analyzeTransaction(tx, slot, blockTime) {
  try {
    // Get enhanced transaction data from Helius
    const enrichedTx = await helius.getEnrichedTransaction(tx.signature);
    if (!enrichedTx) return;

    // Check if transaction involves DEX programs
    const dexInteractions = enrichedTx.instructions.filter((ix) =>
      Object.values(DEX_PROGRAMS).includes(ix.programId)
    );

    if (dexInteractions.length === 0) return;

    // Extract trade information
    const tradeInfo = {
      signature: tx.signature,
      slot,
      blockTime,
      dex: dexInteractions[0].programId,
      instructions: enrichedTx.instructions,
      tokenTransfers: enrichedTx.tokenTransfers,
      accounts: enrichedTx.accountKeys.map((a) => a.toString()),
      computeUnits: enrichedTx.computeUnits,
      fee: enrichedTx.fee,
    };

    // Store trade in recent trades cache
    recentTrades.set(tx.signature, {
      ...tradeInfo,
      timestamp: Date.now(),
    });

    // Clean up old trades (older than 5 minutes)
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    for (const [sig, trade] of recentTrades.entries()) {
      if (trade.timestamp < fiveMinutesAgo) {
        recentTrades.delete(sig);
      }
    }

    // Analyze for patterns
    const patterns = await analyzeTradePatterns(tradeInfo);
    if (patterns.length > 0) {
      tradeInfo.patterns = patterns;

      // Store pattern information
      await firestore.collection("trade_patterns").add({
        ...tradeInfo,
        timestamp: new Date(blockTime * 1000),
      });

      // Publish pattern for potential action
      await topic.publish(
        Buffer.from(
          JSON.stringify({
            type: "trade_pattern",
            data: tradeInfo,
          })
        )
      );
    }

    console.log(`Processed DEX trade in slot ${slot} with patterns: ${patterns.join(", ")}`);
  } catch (error) {
    console.error("Failed to analyze transaction:", error);
  }
}

async function analyzeTradePatterns(trade) {
  const patterns = [];

  // Look for large trades
  if (trade.tokenTransfers.some((t) => t.amount > 10000)) {
    patterns.push("large_trade");
  }

  // Look for multi-hop trades
  if (trade.instructions.length > 2) {
    patterns.push("multi_hop");
  }

  // Look for sandwich opportunities
  const recentTradesArray = Array.from(recentTrades.values());
  const sameTokenTrades = recentTradesArray.filter((t) =>
    t.tokenTransfers.some((tt) => trade.tokenTransfers.some((currentTt) => currentTt.mint === tt.mint))
  );

  if (sameTokenTrades.length > 2) {
    patterns.push("potential_sandwich");
  }

  return patterns;
}

async function main() {
  // Subscribe to Jito Geyser for real-time block data
  await geyserClient.subscribeBlocksAndTxs(
    {
      commitment: "processed",
      accounts: Object.values(DEX_PROGRAMS).map((id) => new PublicKey(id)),
      votePubkey: null,
      includeTransactions: true,
      includeAccounts: true,
      includeEntries: false,
    },
    {
      onBlock: async (block) => {
        for (const tx of block.transactions) {
          await analyzeTransaction(tx, block.slot, block.blockTime);
        }
      },
      onError: (error) => {
        console.error("Geyser subscription error:", error);
      },
    }
  );

  console.log("Started monitoring DEX orderflow");
}

main().catch(console.error);
