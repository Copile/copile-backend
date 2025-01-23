require("dotenv").config();
const express = require("express");
const { Connection, PublicKey, Transaction } = require("@solana/web3.js");
const { JitoRpcClient, SearcherClient } = require("@jito-labs/jito-ts");
const admin = require("firebase-admin");
const winston = require("winston");
const { Firestore } = require("@google-cloud/firestore");
const { PubSub } = require("@google-cloud/pubsub");
const { Helius } = require("helius-sdk");
const Redis = require("redis");
const { Queue, Worker } = require("bullmq");
const { register, Counter, Histogram } = require("prometheus-client");

// Initialize Express app
const app = express();
const port = process.env.PORT || 3001;

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
const helius = new Helius(process.env.HELIUS_API_KEY);

// Initialize Redis
const redisClient = Redis.createClient({
  url: process.env.REDIS_URL,
});

// Initialize metrics
const submissionCounter = new Counter({
  name: "transaction_submissions_total",
  help: "Total number of transaction submissions",
  labelNames: ["status"],
});

const submissionLatency = new Histogram({
  name: "transaction_submission_latency_microseconds",
  help: "Transaction submission latency in microseconds",
  buckets: [100, 200, 300, 400, 500, 1000], // Sub-millisecond buckets
});

// Initialize submission queue
const submissionQueue = new Queue("transaction-submission", {
  connection: redisClient,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
  },
});

// RPC connection pool
class RPCPool {
  constructor() {
    this.connections = new Map();
    this.healthChecks = new Map();
    this.loadBalancer = new LoadBalancer();
  }

  addConnection(name, url) {
    const connection = new Connection(url);
    this.connections.set(name, connection);
    this.healthChecks.set(name, true);
    this.loadBalancer.addEndpoint(name);
  }

  async getOptimalConnection() {
    const endpoint = this.loadBalancer.getOptimalEndpoint();
    return this.connections.get(endpoint);
  }

  updateHealth(name, isHealthy) {
    this.healthChecks.set(name, isHealthy);
    this.loadBalancer.updateEndpointHealth(name, isHealthy);
  }
}

// Load balancer with health checking and latency tracking
class LoadBalancer {
  constructor() {
    this.endpoints = new Map();
    this.latencies = new Map();
  }

  addEndpoint(name) {
    this.endpoints.set(name, true);
    this.latencies.set(name, 0);
  }

  updateEndpointHealth(name, isHealthy) {
    this.endpoints.set(name, isHealthy);
  }

  updateLatency(name, latency) {
    this.latencies.set(name, latency);
  }

  getOptimalEndpoint() {
    const availableEndpoints = Array.from(this.endpoints.entries())
      .filter(([_, isHealthy]) => isHealthy)
      .map(([name]) => name);

    if (availableEndpoints.length === 0) {
      throw new Error("No healthy endpoints available");
    }

    // Return endpoint with lowest latency
    return availableEndpoints.reduce((a, b) =>
      this.latencies.get(a) < this.latencies.get(b) ? a : b
    );
  }
}

// Transaction submission manager
class SubmissionManager {
  constructor() {
    this.rpcPool = new RPCPool();
    this.jitoClient = new JitoRpcClient(process.env.JITO_RPC_URL);
    this.searcherClient = new SearcherClient(process.env.JITO_SEARCHER_URL);

    // Initialize RPC connections
    this.rpcPool.addConnection("jito", process.env.JITO_RPC_URL);
    this.rpcPool.addConnection("mainnet", process.env.SOLANA_RPC_URL);
    this.rpcPool.addConnection("custom", process.env.CUSTOM_RPC_URL);

    this.worker = new Worker(
      "transaction-submission",
      async (job) => {
        const { transaction, options } = job.data;
        return this.submitTransaction(transaction, options);
      },
      { connection: redisClient }
    );
  }

  async submitTransaction(transaction, options = {}) {
    const startTime = process.hrtime.bigint();

    try {
      // Decode transaction
      const tx = Transaction.from(Buffer.from(transaction, "base64"));

      // Validate transaction
      await this.validateTransaction(tx);

      // Get optimal connection
      const connection = await this.rpcPool.getOptimalConnection();

      // Submit based on strategy
      let result;
      if (options.useMEVProtection) {
        result = await this.submitWithMEVProtection(tx);
      } else if (options.useJito) {
        result = await this.submitToJito(tx);
      } else {
        result = await this.submitStandard(connection, tx);
      }

      // Record metrics
      const endTime = process.hrtime.bigint();
      const latencyMicros = Number(endTime - startTime) / 1000;
      submissionLatency.observe(latencyMicros);
      submissionCounter.inc({ status: "success" });

      return result;
    } catch (error) {
      submissionCounter.inc({ status: "error" });
      throw error;
    }
  }

  async validateTransaction(transaction) {
    // Simulate transaction
    const connection = await this.rpcPool.getOptimalConnection();
    const simulation = await connection.simulateTransaction(transaction);

    if (simulation.value.err) {
      throw new Error(`Transaction simulation failed: ${simulation.value.err}`);
    }

    // Additional validation logic here
    return true;
  }

  async submitWithMEVProtection(transaction) {
    // Build bundle with tip-paying transaction
    const bundle = {
      transactions: [transaction],
      header: {
        tip: this.calculateOptimalTip(transaction),
        targetSlot: await this.getTargetSlot(),
      },
    };

    // Submit bundle to Jito
    const result = await this.searcherClient.submitBundle(bundle);

    // Store submission record
    await this.storeSubmission({
      signature: transaction.signatures[0],
      type: "mev_protected",
      bundleId: result.bundleId,
      timestamp: new Date(),
    });

    return result;
  }

  async submitToJito(transaction) {
    const result = await this.jitoClient.sendTransaction(transaction);

    await this.storeSubmission({
      signature: transaction.signatures[0],
      type: "jito",
      timestamp: new Date(),
    });

    return result;
  }

  async submitStandard(connection, transaction) {
    const result = await connection.sendTransaction(transaction);

    await this.storeSubmission({
      signature: transaction.signatures[0],
      type: "standard",
      timestamp: new Date(),
    });

    return result;
  }

  async getTargetSlot() {
    const connection = await this.rpcPool.getOptimalConnection();
    return (await connection.getSlot()) + 1;
  }

  calculateOptimalTip(transaction) {
    // Implementation would calculate optimal tip based on:
    // - Expected profit from transaction
    // - Current network congestion
    // - Competition from other searchers
    return 100000; // Placeholder value in lamports
  }

  async storeSubmission(data) {
    // Store in Redis for quick access
    await redisClient.set(
      `submission:${data.signature}`,
      JSON.stringify(data),
      "EX",
      300 // 5 minute expiry
    );

    // Store in Firestore for persistence
    await firestore.collection("submissions").doc(data.signature).set(data);

    // Publish event
    await topic.publish(
      Buffer.from(
        JSON.stringify({
          type: "transaction_submitted",
          data,
        })
      )
    );
  }
}

// Initialize submission manager
const submissionManager = new SubmissionManager();

// API endpoints
app.post("/submit", async (req, res) => {
  try {
    const { transaction, options } = req.body;

    // Queue transaction for submission
    const job = await submissionQueue.add("submit", {
      transaction,
      options,
      timestamp: Date.now(),
    });

    const result = await job.waitUntilFinished();

    res.json({
      success: true,
      signature: result.signature,
      slot: result.slot,
    });
  } catch (error) {
    logger.error("Submission error:", error);
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
      submissions: submissionCounter.get(),
      averageLatency:
        submissionLatency.get().sum / submissionLatency.get().count,
    },
  });
});

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

// Start the server
app.listen(port, () => {
  logger.info(`Submission service started on port ${port}`);
});

// Handle graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received. Shutting down...");

  // Close Redis connection
  await redisClient.quit();

  process.exit(0);
});
