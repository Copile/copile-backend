require("dotenv").config();
const express = require("express");
const { Connection, PublicKey } = require("@solana/web3.js");
const { JitoRpcClient } = require("@jito-labs/jito-ts");
const admin = require("firebase-admin");
const winston = require("winston");
const WebSocket = require("ws");
const { Firestore } = require("@google-cloud/firestore");
const { PubSub } = require("@google-cloud/pubsub");
const { Helius } = require("helius-sdk");
const Redis = require("redis");
const { Queue, Worker } = require("bullmq");
const { register, Counter, Histogram } = require("prometheus-client");

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000;

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
const transactionCounter = new Counter({
  name: "solana_transactions_total",
  help: "Total number of Solana transactions processed",
});

const processingLatency = new Histogram({
  name: "transaction_processing_latency_microseconds",
  help: "Transaction processing latency in microseconds",
  buckets: [100, 200, 300, 400, 500, 1000], // Sub-millisecond buckets
});

// Initialize processing queue
const processingQueue = new Queue("transaction-processing", {
  connection: redisClient,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
  },
});

// Streaming sources configuration
const STREAM_SOURCES = {
  JITO: {
    url:
      process.env.JITO_WS_URL ||
      "wss://jito-block-engine.mainnet-beta.solana.com",
    enabled: true,
  },
  HELIUS: {
    url: process.env.HELIUS_WS_URL,
    enabled: true,
  },
  CUSTOM_RPC: {
    url: process.env.CUSTOM_RPC_WS_URL,
    enabled: true,
  },
};

// Connection pool for redundancy
class ConnectionPool {
  constructor() {
    this.connections = new Map();
    this.healthChecks = new Map();
  }

  async addConnection(source, url) {
    const ws = new WebSocket(url);

    ws.on("open", () => {
      logger.info(`Connected to ${source}`);
      this.healthChecks.set(source, true);
    });

    ws.on("close", () => {
      logger.warn(`Disconnected from ${source}`);
      this.healthChecks.set(source, false);
      setTimeout(() => this.reconnect(source, url), 1000);
    });

    ws.on("message", async (data) => {
      const startTime = process.hrtime.bigint();

      try {
        const message = JSON.parse(data);
        await this.handleMessage(source, message);

        const endTime = process.hrtime.bigint();
        const latencyMicros = Number(endTime - startTime) / 1000;
        processingLatency.observe(latencyMicros);
      } catch (error) {
        logger.error(`Error processing message from ${source}:`, error);
      }
    });

    this.connections.set(source, ws);
  }

  async handleMessage(source, message) {
    // Queue message for processing
    await processingQueue.add("process-transaction", {
      source,
      message,
      timestamp: Date.now(),
    });

    transactionCounter.inc();
  }

  async reconnect(source, url) {
    try {
      await this.addConnection(source, url);
    } catch (error) {
      logger.error(`Failed to reconnect to ${source}:`, error);
    }
  }

  getHealthStatus() {
    return Object.fromEntries(this.healthChecks);
  }
}

// Transaction processor
class TransactionProcessor {
  constructor() {
    this.worker = new Worker(
      "transaction-processing",
      async (job) => {
        const { source, message, timestamp } = job.data;

        // Process based on source
        switch (source) {
          case "JITO":
            await this.processJitoMessage(message);
            break;
          case "HELIUS":
            await this.processHeliusMessage(message);
            break;
          case "CUSTOM_RPC":
            await this.processCustomMessage(message);
            break;
        }

        // Calculate and log latency
        const latency = Date.now() - timestamp;
        logger.debug(`Processed message from ${source} in ${latency}ms`);
      },
      { connection: redisClient }
    );
  }

  async processJitoMessage(message) {
    if (message.method === "blockSubscribe") {
      const block = message.params.result;
      await this.processBlock(block);
    }
  }

  async processHeliusMessage(message) {
    // Process Helius-specific message format
    const enrichedTx = await helius.getEnrichedTransaction(message.signature);
    await this.processEnrichedTransaction(enrichedTx);
  }

  async processCustomMessage(message) {
    // Process custom RPC message format
    // Implementation depends on custom source
  }

  async processBlock(block) {
    for (const tx of block.transactions || []) {
      await this.processTransaction(tx);
    }
  }

  async processTransaction(tx) {
    // Store in Redis for quick access
    await redisClient.set(
      `tx:${tx.signature}`,
      JSON.stringify(tx),
      "EX",
      300 // 5 minute expiry
    );

    // Publish to PubSub for downstream processing
    await topic.publish(
      Buffer.from(
        JSON.stringify({
          type: "new_transaction",
          data: tx,
          timestamp: Date.now(),
        })
      )
    );

    // Store in Firestore for persistence
    await firestore
      .collection("transactions")
      .doc(tx.signature)
      .set({
        ...tx,
        processedAt: new Date(),
      });
  }

  async processEnrichedTransaction(tx) {
    if (!tx) return;

    // Store enriched data
    await firestore
      .collection("enriched-transactions")
      .doc(tx.signature)
      .set({
        ...tx,
        processedAt: new Date(),
      });

    // Publish enriched data
    await topic.publish(
      Buffer.from(
        JSON.stringify({
          type: "enriched_transaction",
          data: tx,
          timestamp: Date.now(),
        })
      )
    );
  }
}

// Initialize components
const pool = new ConnectionPool();
const processor = new TransactionProcessor();

// Connect to all sources
Object.entries(STREAM_SOURCES)
  .filter(([_, config]) => config.enabled)
  .forEach(([source, config]) => {
    pool.addConnection(source, config.url);
  });

// API endpoints
app.get("/health", (req, res) => {
  const status = pool.getHealthStatus();
  res.json({
    status: "ok",
    connections: status,
    metrics: {
      transactions: transactionCounter.get(),
      averageLatency:
        processingLatency.get().sum / processingLatency.get().count,
    },
  });
});

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

// Start the server
app.listen(port, () => {
  logger.info(`Streaming service started on port ${port}`);
});

// Handle graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received. Shutting down...");

  // Close all WebSocket connections
  for (const [source, ws] of pool.connections) {
    ws.close();
    logger.info(`Closed connection to ${source}`);
  }

  // Close Redis connection
  await redisClient.quit();

  process.exit(0);
});
