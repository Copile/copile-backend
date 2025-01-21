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
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
    new winston.transports.Console(),
  ],
});

// Initialize Solana connection
const connection = new Connection(
  process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com"
);
const jitoClient = new JitoRpcClient(
  process.env.JITO_RPC_URL || "https://jito-api.mainnet-beta.solana.com"
);

// Known DEX program IDs
const DEX_PROGRAMS = {
  SERUM: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
  RAYDIUM: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
  JUPITER: "JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB",
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

  wsConnection = new WebSocket(
    "wss://jito-block-engine.mainnet-beta.solana.com"
  );

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
    const programIds = tx.transaction.message.accountKeys.map((key) =>
      key.toString()
    );

    // Look for DEX transactions
    const dexPrograms = programIds.filter((id) =>
      Object.values(DEX_PROGRAMS).includes(id)
    );
    if (dexPrograms.length === 0) continue;

    // Calculate transaction volume
    const volume = new Decimal(
      Math.abs(tx.meta.preBalances[0] - tx.meta.postBalances[0])
    );

    // Update volume stats
    orderflowState.volumeStats.total =
      orderflowState.volumeStats.total.plus(volume);

    // Update DEX-specific volumes
    dexPrograms.forEach((program) => {
      if (program === DEX_PROGRAMS.SERUM) {
        orderflowState.volumeStats.byDex.serum =
          orderflowState.volumeStats.byDex.serum.plus(volume);
      } else if (program === DEX_PROGRAMS.RAYDIUM) {
        orderflowState.volumeStats.byDex.raydium =
          orderflowState.volumeStats.byDex.raydium.plus(volume);
      } else if (program === DEX_PROGRAMS.JUPITER) {
        orderflowState.volumeStats.byDex.jupiter =
          orderflowState.volumeStats.byDex.jupiter.plus(volume);
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
    await admin
      .firestore()
      .collection("orderflow")
      .doc(signature)
      .set(orderInfo);
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

    const volume = windowOrders.reduce(
      (acc, order) => acc.plus(new Decimal(order.volume)),
      new Decimal(0)
    );

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
