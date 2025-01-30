require("dotenv").config();
const express = require("express");
const { Connection, PublicKey } = require("@solana/web3.js");
const { JitoRpcClient } = require("@jito-labs/jito-ts");
const admin = require("firebase-admin");
const winston = require("winston");
const { Firestore } = require("@google-cloud/firestore");
const { PubSub } = require("@google-cloud/pubsub");
const Redis = require("redis");
const { Queue, Worker } = require("bullmq");
const { register, Counter, Histogram, Gauge } = require("prometheus-client");
const fetch = require("node-fetch");
const io = require("socket.io")(3002);

// Initialize Express app
const app = express();
const port = process.env.PORT || 3002;

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
const topic = pubsub.topic(process.env.PUBSUB_TOPIC);

// Initialize Redis
const redisClient = Redis.createClient({
  url: process.env.REDIS_URL,
});

// Initialize metrics
const networkLatency = new Histogram({
  name: "solana_network_latency_ms",
  help: "Solana network latency in milliseconds",
  buckets: [10, 50, 100, 200, 500, 1000],
});

const blockTime = new Histogram({
  name: "solana_block_time_ms",
  help: "Time between blocks in milliseconds",
  buckets: [200, 300, 400, 500, 600, 800, 1000],
});

const tpsGauge = new Gauge({
  name: "solana_current_tps",
  help: "Current transactions per second",
});

const slotGauge = new Gauge({
  name: "solana_current_slot",
  help: "Current slot number",
});

const validatorCount = new Gauge({
  name: "solana_active_validators",
  help: "Number of active validators",
});

const networkCongestion = new Gauge({
  name: "solana_network_congestion",
  help: "Network congestion score (0-1)",
});

// RPC endpoints for monitoring
const RPC_ENDPOINTS = [
  {
    name: "Mainnet Primary",
    url: process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
  },
  {
    name: "Jito",
    url: process.env.JITO_RPC_URL || "https://jito-api.mainnet-beta.solana.com",
  },
  {
    name: "GenesysGo",
    url: process.env.GENESYS_RPC_URL,
  },
];

// Network health thresholds
const THRESHOLDS = {
  MAX_BLOCK_TIME: 800, // ms
  MIN_TPS: 1000,
  MAX_LATENCY: 500, // ms
  MIN_VALIDATOR_COUNT: 1000,
  MAX_CONGESTION: 0.8,
};

// Network health monitor
class NetworkHealthMonitor {
  constructor() {
    this.connections = new Map();
    this.metrics = {
      lastSlot: 0,
      lastBlockTime: Date.now(),
      recentBlockTimes: [],
      validatorStats: new Map(),
      congestionHistory: [],
    };

    this.alertQueue = new Queue("network-alerts", {
      connection: redisClient,
    });

    this.setupConnections();
    this.startMonitoring();
  }

  setupConnections() {
    RPC_ENDPOINTS.forEach(({ name, url }) => {
      if (url) {
        this.connections.set(name, new Connection(url));
        logger.info(`Connected to ${name} RPC endpoint`);
      }
    });
  }

  async startMonitoring() {
    // Start different monitoring tasks
    this.monitorSlots();
    this.monitorValidators();
    this.monitorNetworkCongestion();
    this.monitorPerformance();

    // Set up alert processing
    this.processAlerts();
  }

  async monitorSlots() {
    const connection = this.connections.get("Mainnet Primary");
    if (!connection) return;

    connection.onSlotChange((slot) => {
      const now = Date.now();
      const blockTimeMs = now - this.metrics.lastBlockTime;

      // Update metrics
      this.metrics.recentBlockTimes.push(blockTimeMs);
      if (this.metrics.recentBlockTimes.length > 100) {
        this.metrics.recentBlockTimes.shift();
      }

      // Update Prometheus metrics
      slotGauge.set(slot.slot);
      blockTime.observe(blockTimeMs);

      // Check for anomalies
      if (blockTimeMs > THRESHOLDS.MAX_BLOCK_TIME) {
        this.queueAlert({
          type: "high_block_time",
          value: blockTimeMs,
          threshold: THRESHOLDS.MAX_BLOCK_TIME,
          slot: slot.slot,
        });
      }

      // Update state
      this.metrics.lastSlot = slot.slot;
      this.metrics.lastBlockTime = now;

      // Emit real-time update
      io.emit("slot_update", {
        slot: slot.slot,
        blockTime: blockTimeMs,
        timestamp: now,
      });
    });
  }

  async monitorValidators() {
    setInterval(async () => {
      try {
        const connection = this.connections.get("Mainnet Primary");
        if (!connection) return;

        // Get current validators
        const validators = await connection.getVoteAccounts();
        const activeValidators = validators.current.length;

        // Update metrics
        validatorCount.set(activeValidators);

        // Analyze validator performance
        const performanceStats = this.analyzeValidatorPerformance(validators);

        // Store historical data
        await this.storeValidatorStats(performanceStats);

        // Check for issues
        if (activeValidators < THRESHOLDS.MIN_VALIDATOR_COUNT) {
          this.queueAlert({
            type: "low_validator_count",
            value: activeValidators,
            threshold: THRESHOLDS.MIN_VALIDATOR_COUNT,
          });
        }

        // Emit real-time update
        io.emit("validator_update", {
          activeValidators,
          performanceStats,
          timestamp: Date.now(),
        });
      } catch (error) {
        logger.error("Error monitoring validators:", error);
      }
    }, 60000); // Check every minute
  }

  async monitorNetworkCongestion() {
    setInterval(async () => {
      try {
        const connection = this.connections.get("Mainnet Primary");
        if (!connection) return;

        // Get recent performance samples
        const perfSamples = await connection.getRecentPerformanceSamples(60);

        // Calculate TPS
        const recentTps = this.calculateRecentTPS(perfSamples);
        tpsGauge.set(recentTps);

        // Calculate congestion score (0-1)
        const congestionScore = this.calculateCongestionScore(perfSamples);
        networkCongestion.set(congestionScore);

        // Update history
        this.metrics.congestionHistory.push({
          timestamp: Date.now(),
          score: congestionScore,
          tps: recentTps,
        });

        if (this.metrics.congestionHistory.length > 1440) {
          // Keep 24 hours
          this.metrics.congestionHistory.shift();
        }

        // Check for high congestion
        if (congestionScore > THRESHOLDS.MAX_CONGESTION) {
          this.queueAlert({
            type: "high_congestion",
            value: congestionScore,
            threshold: THRESHOLDS.MAX_CONGESTION,
            tps: recentTps,
          });
        }

        // Emit real-time update
        io.emit("congestion_update", {
          congestionScore,
          tps: recentTps,
          timestamp: Date.now(),
        });
      } catch (error) {
        logger.error("Error monitoring network congestion:", error);
      }
    }, 10000); // Check every 10 seconds
  }

  async monitorPerformance() {
    setInterval(async () => {
      for (const [name, connection] of this.connections) {
        try {
          const startTime = Date.now();
          await connection.getSlot();
          const latency = Date.now() - startTime;

          // Update metrics
          networkLatency.observe(latency);

          // Check for high latency
          if (latency > THRESHOLDS.MAX_LATENCY) {
            this.queueAlert({
              type: "high_latency",
              endpoint: name,
              value: latency,
              threshold: THRESHOLDS.MAX_LATENCY,
            });
          }
        } catch (error) {
          logger.error(`Error checking ${name} performance:`, error);
          this.queueAlert({
            type: "endpoint_error",
            endpoint: name,
            error: error.message,
          });
        }
      }
    }, 5000); // Check every 5 seconds
  }

  calculateRecentTPS(perfSamples) {
    if (!perfSamples || perfSamples.length === 0) return 0;
    const recentSample = perfSamples[0];
    return recentSample.numTransactions / recentSample.samplePeriodSecs;
  }

  calculateCongestionScore(perfSamples) {
    if (!perfSamples || perfSamples.length === 0) return 0;

    // Calculate average TPS and its relation to network capacity
    const avgTps =
      perfSamples.reduce(
        (sum, sample) => sum + sample.numTransactions / sample.samplePeriodSecs,
        0
      ) / perfSamples.length;

    // Normalize against Solana's theoretical max TPS (50k)
    const normalizedTps = Math.min(avgTps / 50000, 1);

    // Factor in transaction success rate
    const successRate =
      perfSamples[0].numTransactions > 0
        ? 1 -
          perfSamples[0].numTransactionsError / perfSamples[0].numTransactions
        : 1;

    // Combine metrics into a congestion score
    return normalizedTps * 0.7 + (1 - successRate) * 0.3;
  }

  analyzeValidatorPerformance(validators) {
    const stats = {
      totalStake: 0,
      averageDelinquent: 0,
      topPerformers: [],
      recentDelinquent: [],
    };

    // Analyze current validators
    validators.current.forEach((validator) => {
      stats.totalStake += validator.activatedStake;

      if (validator.delinquent) {
        stats.averageDelinquent++;
        stats.recentDelinquent.push({
          votePubkey: validator.votePubkey,
          stake: validator.activatedStake,
        });
      }
    });

    // Calculate percentages
    stats.averageDelinquent =
      (stats.averageDelinquent / validators.current.length) * 100;

    // Sort and get top performers
    stats.topPerformers = validators.current
      .sort((a, b) => b.activatedStake - a.activatedStake)
      .slice(0, 10)
      .map((v) => ({
        votePubkey: v.votePubkey,
        stake: v.activatedStake,
        credits: v.epochCredits,
      }));

    return stats;
  }

  async storeValidatorStats(stats) {
    try {
      await firestore.collection("validator-stats").add({
        ...stats,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error("Error storing validator stats:", error);
    }
  }

  async queueAlert(alert) {
    try {
      await this.alertQueue.add("network-alert", {
        ...alert,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error("Error queueing alert:", error);
    }
  }

  processAlerts() {
    new Worker(
      "network-alerts",
      async (job) => {
        const alert = job.data;

        // Store alert in Firestore
        await firestore.collection("network-alerts").add(alert);

        // Publish to PubSub for external processing
        await topic.publish(Buffer.from(JSON.stringify(alert)));

        // Emit real-time alert
        io.emit("network_alert", alert);

        logger.info("Network alert processed:", alert);
      },
      { connection: redisClient }
    );
  }
}

// Initialize network monitor
const monitor = new NetworkHealthMonitor();

// API endpoints
app.get("/health", (req, res) => {
  const status = {
    status: "ok",
    currentSlot: monitor.metrics.lastSlot,
    lastBlockTime: monitor.metrics.lastBlockTime,
    connections: Array.from(monitor.connections.keys()),
  };

  res.json(status);
});

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.get("/stats/validators", async (req, res) => {
  try {
    const connection = monitor.connections.get("Mainnet Primary");
    const validators = await connection.getVoteAccounts();
    const stats = monitor.analyzeValidatorPerformance(validators);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/stats/congestion", (req, res) => {
  res.json({
    current:
      monitor.metrics.congestionHistory[
        monitor.metrics.congestionHistory.length - 1
      ],
    history: monitor.metrics.congestionHistory,
  });
});

app.get("/stats/performance", async (req, res) => {
  try {
    const connection = monitor.connections.get("Mainnet Primary");
    const perfSamples = await connection.getRecentPerformanceSamples(60);
    res.json({
      tps: monitor.calculateRecentTPS(perfSamples),
      congestionScore: monitor.calculateCongestionScore(perfSamples),
      samples: perfSamples,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start the server
app.listen(port, () => {
  logger.info(`Network health monitor started on port ${port}`);
});

// Handle graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received. Shutting down...");

  // Close Redis connection
  await redisClient.quit();

  process.exit(0);
});
