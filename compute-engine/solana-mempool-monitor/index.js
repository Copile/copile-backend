require("dotenv").config();
const express = require("express");
const { Connection, PublicKey } = require("@solana/web3.js");
const { JitoRpcClient } = require("@jito-labs/jito-ts");
const admin = require("firebase-admin");
const winston = require("winston");
const WebSocket = require("ws");
const NodeCache = require("node-cache");

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

// Mempool state
let mempoolTransactions = new Map();
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
  const transactions = block.transactions || [];

  for (const tx of transactions) {
    const signature = tx.transaction.signatures[0];
    const programIds = tx.transaction.message.accountKeys.map((key) =>
      key.toString()
    );

    // Look for DEX transactions
    const isDexTx = programIds.some((id) =>
      Object.values(DEX_PROGRAMS).includes(id)
    );

    if (isDexTx) {
      mempoolTransactions.set(signature, {
        signature,
        timestamp: new Date().toISOString(),
        programIds,
        blockHeight: block.parentSlot,
        type: "dex",
      });

      // Store in Firebase for persistence
      await admin
        .firestore()
        .collection("mempool-transactions")
        .doc(signature)
        .set({
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
