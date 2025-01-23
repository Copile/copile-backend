require("dotenv").config();
const express = require("express");
const { Connection, PublicKey, Transaction } = require("@solana/web3.js");
const { JitoRpcClient } = require("@jito-labs/jito-ts");
const admin = require("firebase-admin");
const winston = require("winston");
const { Firestore } = require("@google-cloud/firestore");
const { PubSub } = require("@google-cloud/pubsub");
const { Helius } = require("helius-sdk");
const Redis = require("redis");
const { Queue, Worker } = require("bullmq");
const { register, Counter, Histogram } = require("prometheus-client");
const Decimal = require("decimal.js");

// Initialize Express app
const app = express();
const port = process.env.PORT || 3002;
app.use(express.json());

// Initialize Firebase
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

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

// Initialize clients
const firestore = new Firestore();
const pubsub = new PubSub();
const subscriptionName = process.env.PUBSUB_SUBSCRIPTION;
const subscription = pubsub.subscription(subscriptionName);
const helius = new Helius(process.env.HELIUS_API_KEY);

// Initialize Redis
const redisClient = Redis.createClient({
  url: process.env.REDIS_URL,
});

// Initialize metrics
const copyTradeCounter = new Counter({
  name: "copy_trades_total",
  help: "Total number of copy trades",
  labelNames: ["status", "strategy"],
});

const copyTradeLatency = new Histogram({
  name: "copy_trade_latency_microseconds",
  help: "Copy trade execution latency in microseconds",
  buckets: [100, 200, 300, 400, 500, 1000], // Sub-millisecond buckets
});

// Initialize copy trade queue
const copyTradeQueue = new Queue("copy-trade", {
  connection: redisClient,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
  },
});

// Copy trading manager
class CopyTradingManager {
  constructor() {
    this.connection = new Connection(process.env.SOLANA_RPC_URL);
    this.jitoClient = new JitoRpcClient(process.env.JITO_RPC_URL);
    this.strategies = new Map();
    this.trackedWallets = new Set();

    this.worker = new Worker(
      "copy-trade",
      async (job) => {
        const { transaction, strategy, sourceWallet } = job.data;
        return this.executeCopyTrade(transaction, strategy, sourceWallet);
      },
      { connection: redisClient }
    );

    // Initialize subscription handling
    this.initializeSubscription();
  }

  async initializeSubscription() {
    // Load tracked wallets and strategies
    await this.loadConfiguration();

    // Handle incoming messages
    subscription.on("message", async (message) => {
      try {
        const data = JSON.parse(message.data.toString());

        if (data.type === "transaction_detected") {
          await this.handleTransaction(data.transaction, data.wallet);
        }

        message.ack();
      } catch (error) {
        logger.error("Error processing message:", error);
        message.nack();
      }
    });
  }

  async loadConfiguration() {
    // Load strategies from Firestore
    const strategiesSnapshot = await firestore.collection("strategies").get();
    strategiesSnapshot.forEach((doc) => {
      const strategy = doc.data();
      this.strategies.set(doc.id, strategy);

      // Add wallets to tracking
      strategy.sourceWallets.forEach((wallet) => {
        this.trackedWallets.add(wallet);
      });
    });

    logger.info(
      `Loaded ${this.strategies.size} strategies and ${this.trackedWallets.size} wallets`
    );
  }

  async handleTransaction(transaction, sourceWallet) {
    const startTime = process.hrtime.bigint();

    try {
      // Find relevant strategies for this wallet
      const relevantStrategies = Array.from(this.strategies.entries()).filter(
        ([_, strategy]) => strategy.sourceWallets.includes(sourceWallet)
      );

      if (relevantStrategies.length === 0) {
        return;
      }

      // Process transaction for each strategy
      for (const [strategyId, strategy] of relevantStrategies) {
        // Validate transaction against strategy rules
        if (!this.validateTransactionForStrategy(transaction, strategy)) {
          continue;
        }

        // Queue copy trade execution
        await copyTradeQueue.add("execute", {
          transaction,
          strategy,
          sourceWallet,
          timestamp: Date.now(),
        });

        // Record metrics
        const endTime = process.hrtime.bigint();
        const latencyMicros = Number(endTime - startTime) / 1000;
        copyTradeLatency.observe(latencyMicros);
        copyTradeCounter.inc({ status: "queued", strategy: strategyId });
      }
    } catch (error) {
      logger.error("Error handling transaction:", error);
      copyTradeCounter.inc({ status: "error" });
    }
  }

  validateTransactionForStrategy(transaction, strategy) {
    try {
      // Check transaction type
      if (
        !this.matchesTransactionType(transaction, strategy.transactionTypes)
      ) {
        return false;
      }

      // Check minimum value
      if (!this.meetsMinimumValue(transaction, strategy.minimumValue)) {
        return false;
      }

      // Check program whitelist
      if (!this.isWhitelistedProgram(transaction, strategy.programWhitelist)) {
        return false;
      }

      // Check risk parameters
      if (!this.meetsRiskParameters(transaction, strategy.riskParameters)) {
        return false;
      }

      return true;
    } catch (error) {
      logger.error("Error validating transaction:", error);
      return false;
    }
  }

  matchesTransactionType(transaction, allowedTypes) {
    // Implementation would check if transaction matches allowed types
    // (e.g., SWAP, STAKE, LP_DEPOSIT, etc.)
    return true; // Placeholder
  }

  meetsMinimumValue(transaction, minimumValue) {
    // Implementation would calculate total value of transaction
    // and compare against minimum
    return true; // Placeholder
  }

  isWhitelistedProgram(transaction, whitelist) {
    // Implementation would check if all program IDs in transaction
    // are in the whitelist
    return true; // Placeholder
  }

  meetsRiskParameters(transaction, parameters) {
    // Implementation would check various risk parameters like:
    // - Slippage tolerance
    // - Maximum position size
    // - Leverage limits
    // - etc.
    return true; // Placeholder
  }

  async executeCopyTrade(transaction, strategy, sourceWallet) {
    const startTime = process.hrtime.bigint();

    try {
      // Modify transaction for follower wallets
      const modifiedTx = await this.modifyTransactionForFollowers(
        transaction,
        strategy
      );

      // Submit to submission service
      const response = await fetch(
        `${process.env.SUBMISSION_SERVICE_URL}/submit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            transaction: modifiedTx.serialize().toString("base64"),
            options: {
              useMEVProtection: strategy.useMEVProtection,
              useJito: strategy.useJito,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Submission failed: ${response.statusText}`);
      }

      const result = await response.json();

      // Store copy trade record
      await this.storeCopyTrade({
        sourceWallet,
        strategy: strategy.id,
        sourceTx: transaction.signatures[0],
        copyTx: result.signature,
        timestamp: new Date(),
        status: "executed",
      });

      // Record metrics
      const endTime = process.hrtime.bigint();
      const latencyMicros = Number(endTime - startTime) / 1000;
      copyTradeLatency.observe(latencyMicros);
      copyTradeCounter.inc({ status: "success", strategy: strategy.id });

      return result;
    } catch (error) {
      logger.error("Error executing copy trade:", error);
      copyTradeCounter.inc({ status: "error", strategy: strategy.id });
      throw error;
    }
  }

  async modifyTransactionForFollowers(transaction, strategy) {
    // Implementation would:
    // 1. Decode transaction instructions
    // 2. Modify accounts and data for follower wallets
    // 3. Adjust quantities based on strategy parameters
    // 4. Sign with follower wallet(s)
    return transaction; // Placeholder
  }

  async storeCopyTrade(data) {
    // Store in Redis for quick access
    await redisClient.set(
      `copy_trade:${data.copyTx}`,
      JSON.stringify(data),
      "EX",
      300 // 5 minute expiry
    );

    // Store in Firestore for persistence
    await firestore.collection("copy_trades").doc(data.copyTx).set(data);
  }
}

// Initialize copy trading manager
const copyTradingManager = new CopyTradingManager();

// API endpoints
app.post("/strategies", async (req, res) => {
  try {
    const strategy = req.body;

    // Validate strategy configuration
    if (!strategy.sourceWallets || !Array.isArray(strategy.sourceWallets)) {
      throw new Error("Invalid strategy configuration");
    }

    // Store strategy
    const docRef = await firestore.collection("strategies").add(strategy);

    // Update local state
    copyTradingManager.strategies.set(docRef.id, strategy);
    strategy.sourceWallets.forEach((wallet) => {
      copyTradingManager.trackedWallets.add(wallet);
    });

    res.json({
      success: true,
      strategyId: docRef.id,
    });
  } catch (error) {
    logger.error("Error creating strategy:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get("/strategies/:id", async (req, res) => {
  try {
    const doc = await firestore
      .collection("strategies")
      .doc(req.params.id)
      .get();

    if (!doc.exists) {
      res.status(404).json({
        success: false,
        error: "Strategy not found",
      });
      return;
    }

    res.json({
      success: true,
      strategy: {
        id: doc.id,
        ...doc.data(),
      },
    });
  } catch (error) {
    logger.error("Error fetching strategy:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get("/copy-trades", async (req, res) => {
  try {
    const { wallet, strategy, limit = 100 } = req.query;

    let query = firestore.collection("copy_trades");

    if (wallet) {
      query = query.where("sourceWallet", "==", wallet);
    }

    if (strategy) {
      query = query.where("strategy", "==", strategy);
    }

    const snapshot = await query
      .orderBy("timestamp", "desc")
      .limit(limit)
      .get();

    const trades = [];
    snapshot.forEach((doc) => {
      trades.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    res.json({
      success: true,
      trades,
    });
  } catch (error) {
    logger.error("Error fetching copy trades:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    metrics: {
      strategies: copyTradingManager.strategies.size,
      trackedWallets: copyTradingManager.trackedWallets.size,
      copyTrades: copyTradeCounter.get(),
      averageLatency: copyTradeLatency.get().sum / copyTradeLatency.get().count,
    },
  });
});

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

// Start the server
app.listen(port, () => {
  logger.info(`Copy trading service started on port ${port}`);
});

// Handle graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received. Shutting down...");

  // Close Redis connection
  await redisClient.quit();

  // Close PubSub subscription
  await subscription.close();

  process.exit(0);
});
