require("dotenv").config();
const express = require("express");
const { Connection, PublicKey } = require("@solana/web3.js");
const { JitoRpcClient } = require("@jito-labs/jito-ts");
const admin = require("firebase-admin");
const winston = require("winston");
const WebSocket = require("ws");
const NodeCache = require("node-cache");
const { Firestore } = require("@google-cloud/firestore");
const { PubSub } = require("@google-cloud/pubsub");
const Redis = require("redis");
const { Queue, Worker } = require("bullmq");
const { register, Counter, Histogram, Gauge } = require("prometheus-client");
const io = require("socket.io")(3003);

// Initialize Express app
const app = express();
const port = process.env.PORT || 3003;

// Initialize Firebase
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
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
const programInvocations = new Counter({
  name: "solana_program_invocations_total",
  help: "Total number of program invocations",
  labelNames: ["program_id", "status"],
});

const programLatency = new Histogram({
  name: "solana_program_latency_ms",
  help: "Program execution latency in milliseconds",
  labelNames: ["program_id"],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
});

const programErrors = new Counter({
  name: "solana_program_errors_total",
  help: "Total number of program errors",
  labelNames: ["program_id", "error_type"],
});

const activeSubscriptions = new Gauge({
  name: "solana_program_active_subscriptions",
  help: "Number of active program subscriptions",
});

class ProgramMonitor {
  constructor() {
    this.connections = new Map();
    this.subscriptions = new Map();
    this.programStats = new Map();
    this.alertQueue = new Queue("program-alerts", {
      connection: redisClient,
    });

    this.setupConnections();
    this.startMonitoring();
    this.processAlerts();
  }

  setupConnections() {
    const endpoints = [
      {
        name: "Mainnet Primary",
        url:
          process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
      },
      {
        name: "Jito",
        url:
          process.env.JITO_RPC_URL ||
          "https://jito-api.mainnet-beta.solana.com",
      },
    ];

    endpoints.forEach(({ name, url }) => {
      if (url) {
        this.connections.set(name, new Connection(url));
        logger.info(`Connected to ${name} RPC endpoint`);
      }
    });
  }

  async startMonitoring() {
    await this.loadTrackedPrograms();
    this.monitorProgramActivity();
    this.collectProgramMetrics();
  }

  async loadTrackedPrograms() {
    try {
      const snapshot = await firestore.collection("tracked_programs").get();
      snapshot.forEach((doc) => {
        const data = doc.data();
        this.subscribeToProgram(new PublicKey(data.programId));
      });
    } catch (error) {
      logger.error("Failed to load tracked programs:", error);
    }
  }

  async subscribeToProgram(programId) {
    try {
      const connection = this.connections.get("Mainnet Primary");
      if (!connection) return;

      const subscriptionId = connection.onProgramAccountChange(
        programId,
        async (accountInfo, context) => {
          await this.handleProgramActivity(programId, accountInfo, context);
        },
        "confirmed"
      );

      this.subscriptions.set(programId.toString(), subscriptionId);
      activeSubscriptions.inc();

      logger.info(`Subscribed to program: ${programId.toString()}`);
    } catch (error) {
      logger.error(
        `Failed to subscribe to program ${programId.toString()}:`,
        error
      );
      programErrors.inc({
        program_id: programId.toString(),
        error_type: "subscription_error",
      });
    }
  }

  async handleProgramActivity(programId, accountInfo, context) {
    const timestamp = Date.now();
    const programIdStr = programId.toString();

    try {
      // Update invocation metrics
      programInvocations.inc({ program_id: programIdStr, status: "success" });

      // Calculate and record latency
      const latency = Date.now() - context.slot * 400; // Approximate ms since slot
      programLatency.observe({ program_id: programIdStr }, latency);

      // Update program statistics
      const stats = this.programStats.get(programIdStr) || {
        totalInvocations: 0,
        errorCount: 0,
        averageLatency: 0,
        lastActivity: null,
      };

      stats.totalInvocations++;
      stats.averageLatency =
        (stats.averageLatency * (stats.totalInvocations - 1) + latency) /
        stats.totalInvocations;
      stats.lastActivity = timestamp;

      this.programStats.set(programIdStr, stats);

      // Store activity in Firestore
      await firestore.collection("program_activity").add({
        programId: programIdStr,
        slot: context.slot,
        timestamp,
        latency,
        dataSize: accountInfo.data.length,
      });

      // Emit real-time update
      io.emit("program_activity", {
        programId: programIdStr,
        timestamp,
        slot: context.slot,
        latency,
      });

      // Check for anomalies
      await this.detectAnomalies(programId, stats, latency);
    } catch (error) {
      logger.error(
        `Error handling program activity for ${programIdStr}:`,
        error
      );
      programErrors.inc({
        program_id: programIdStr,
        error_type: "processing_error",
      });
    }
  }

  async detectAnomalies(programId, stats, latency) {
    const programIdStr = programId.toString();
    const thresholds = await this.getThresholds(programId);

    if (latency > thresholds.maxLatency) {
      await this.queueAlert({
        type: "high_latency",
        programId: programIdStr,
        value: latency,
        threshold: thresholds.maxLatency,
        timestamp: Date.now(),
      });
    }

    // Add more anomaly detection logic here
  }

  async getThresholds(programId) {
    const cached = await redisClient.get(`thresholds:${programId.toString()}`);
    if (cached) return JSON.parse(cached);

    // Default thresholds
    return {
      maxLatency: 1000, // ms
      errorRateThreshold: 0.05,
      minThroughput: 10,
    };
  }

  async queueAlert(alert) {
    try {
      await this.alertQueue.add("program-alert", alert);
    } catch (error) {
      logger.error("Failed to queue alert:", error);
    }
  }

  processAlerts() {
    new Worker(
      "program-alerts",
      async (job) => {
        const alert = job.data;

        // Store alert in Firestore
        await firestore.collection("program_alerts").add({
          ...alert,
          processed: new Date(),
        });

        // Publish to PubSub for external processing
        await topic.publish(Buffer.from(JSON.stringify(alert)));

        // Emit real-time alert
        io.emit("program_alert", alert);

        logger.info("Program alert processed:", alert);
      },
      { connection: redisClient }
    );
  }

  collectProgramMetrics() {
    setInterval(() => {
      this.programStats.forEach((stats, programId) => {
        // Store metrics in Firestore
        firestore.collection("program_metrics").add({
          programId,
          ...stats,
          timestamp: new Date(),
        });
      });
    }, 60000); // Every minute
  }
}

// Initialize program monitor
const monitor = new ProgramMonitor();

// API endpoints
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    activeSubscriptions: monitor.subscriptions.size,
    connections: Array.from(monitor.connections.keys()),
  });
});

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.get("/programs/stats", (req, res) => {
  const stats = {};
  monitor.programStats.forEach((value, key) => {
    stats[key] = value;
  });
  res.json(stats);
});

app.get("/programs/alerts", async (req, res) => {
  try {
    const snapshot = await firestore
      .collection("program_alerts")
      .orderBy("timestamp", "desc")
      .limit(100)
      .get();

    const alerts = [];
    snapshot.forEach((doc) => {
      alerts.push(doc.data());
    });

    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start the server
app.listen(port, () => {
  logger.info(`Program monitor started on port ${port}`);
});

// Handle graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received. Shutting down...");

  // Close all subscriptions
  for (const [programId, subscriptionId] of monitor.subscriptions) {
    const connection = monitor.connections.get("Mainnet Primary");
    if (connection) {
      connection.removeAccountChangeListener(subscriptionId);
      logger.info(`Unsubscribed from program: ${programId}`);
    }
  }

  // Close Redis connection
  await redisClient.quit();

  process.exit(0);
});
