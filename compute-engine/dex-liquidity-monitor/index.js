require("dotenv").config();
const express = require("express");
const { Connection, PublicKey } = require("@solana/web3.js");
const { Market } = require("@project-serum/serum");
const { Liquidity } = require("@raydium-io/raydium-sdk");
const admin = require("firebase-admin");
const winston = require("winston");
const NodeCache = require("node-cache");
const Decimal = require("decimal.js");
const { GeyserClient } = require("jito-ts/dist/sdk");
const { Firestore } = require("@google-cloud/firestore");
const { PubSub } = require("@google-cloud/pubsub");
const { Helius } = require("helius-sdk");

// Initialize Express app
const app = express();
const port = process.env.PORT || 3002;

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

// Initialize Helius client for enhanced data
const helius = new Helius(process.env.HELIUS_API_KEY);

// Initialize Jito client
const geyserClient = new GeyserClient(process.env.JITO_GEYSER_URL);

// Initialize Solana connection
const connection = new Connection(process.env.JITO_RPC_URL);

// Known DEX program IDs and markets
const DEX_PROGRAMS = {
  SERUM: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
  RAYDIUM: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
  JUPITER: "JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB",
};

// Tracked markets
const TRACKED_MARKETS = {
  "SOL/USDC": "HWHvQhFmJB3NUcu1aihKmrKegfVxBEHzwVX6yZCKEsi1",
  "SOL/USDT": "2E1F6xCikwQJzfqC6J3WdxEYmvJdHj6xqpgH5QPNF5Jm",
  // Add more markets here
};

// Liquidity monitoring state
let liquidityState = {
  markets: {},
  lastUpdate: null,
};

// DEX program and pool configurations
const DEX_CONFIGS = {
  JUPITER: {
    programId: "JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB",
    pools: new Map(), // Will be populated with pool addresses
  },
  RAYDIUM: {
    programId: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
    pools: new Map(),
  },
  ORCA: {
    programId: "9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP",
    pools: new Map(),
  },
};

// Cache of pool states for quick access
const poolStates = new Map();

async function updatePoolConfigs() {
  try {
    const snapshot = await firestore.collection("dex_pools").get();
    snapshot.forEach((doc) => {
      const pool = doc.data();
      const dex = DEX_CONFIGS[pool.dex];
      if (dex) {
        dex.pools.set(pool.address, {
          address: new PublicKey(pool.address),
          tokenA: new PublicKey(pool.tokenA),
          tokenB: new PublicKey(pool.tokenB),
          decimalsA: pool.decimalsA,
          decimalsB: pool.decimalsB,
        });
      }
    });
    console.log("Updated pool configurations");
  } catch (error) {
    console.error("Failed to update pool configs:", error);
  }
}

async function monitorPoolState(pool, dex) {
  try {
    const account = await connection.getAccountInfo(pool.address);
    if (!account) return;

    // Decode pool state based on DEX-specific layout
    let state;
    switch (dex) {
      case "RAYDIUM":
        state = decodeRaydiumPool(account.data);
        break;
      case "ORCA":
        state = decodeOrcaPool(account.data);
        break;
      default:
        return;
    }

    const prevState = poolStates.get(pool.address.toString());
    poolStates.set(pool.address.toString(), state);

    // Check for significant changes
    if (prevState && hasSignificantChange(prevState, state)) {
      const change = {
        pool: pool.address.toString(),
        dex,
        tokenA: pool.tokenA.toString(),
        tokenB: pool.tokenB.toString(),
        oldState: prevState,
        newState: state,
        timestamp: new Date(),
      };

      // Store change in Firestore
      await firestore.collection("pool_changes").add(change);

      // Publish change for potential action
      await topic.publish(
        Buffer.from(
          JSON.stringify({
            type: "pool_state_change",
            data: change,
          })
        )
      );

      console.log(`Detected significant change in ${dex} pool ${pool.address}`);
    }
  } catch (error) {
    console.error(`Failed to monitor pool ${pool.address}:`, error);
  }
}

function decodeRaydiumPool(data) {
  // Implementation would decode Raydium pool state
  // This is a placeholder for the actual decoding logic
  return {
    reserveA: 0,
    reserveB: 0,
    lpSupply: 0,
    timestamp: Date.now(),
  };
}

function decodeOrcaPool(data) {
  // Implementation would decode Orca pool state
  // This is a placeholder for the actual decoding logic
  return {
    reserveA: 0,
    reserveB: 0,
    lpSupply: 0,
    timestamp: Date.now(),
  };
}

function hasSignificantChange(oldState, newState) {
  // Check for significant changes in pool state
  // This is a placeholder for actual change detection logic
  const reserveChangeThreshold = 0.05; // 5%

  const reserveAChange = Math.abs(newState.reserveA - oldState.reserveA) / oldState.reserveA;
  const reserveBChange = Math.abs(newState.reserveB - oldState.reserveB) / oldState.reserveB;

  return reserveAChange > reserveChangeThreshold || reserveBChange > reserveChangeThreshold;
}

async function monitorAllPools() {
  for (const [dexName, dex] of Object.entries(DEX_CONFIGS)) {
    for (const [_, pool] of dex.pools) {
      await monitorPoolState(pool, dexName);
    }
  }
}

async function main() {
  // Initial load of pool configurations
  await updatePoolConfigs();

  // Watch for changes to pool configurations
  firestore.collection("dex_pools").onSnapshot(() => updatePoolConfigs());

  // Start periodic pool monitoring
  setInterval(monitorAllPools, 1000); // Monitor every second

  // Subscribe to Jito Geyser for real-time updates
  await geyserClient.subscribeBlocksAndTxs(
    {
      commitment: "processed",
      accounts: Object.values(DEX_CONFIGS).map((dex) => new PublicKey(dex.programId)),
      votePubkey: null,
      includeTransactions: true,
      includeAccounts: true,
      includeEntries: false,
    },
    {
      onBlock: async (block) => {
        // Additional real-time monitoring logic here
        console.log(`Processed block ${block.slot}`);
      },
      onError: (error) => {
        console.error("Geyser subscription error:", error);
      },
    }
  );

  console.log("Started monitoring DEX liquidity");
}

main().catch(console.error);

// Monitor market liquidity
async function monitorMarketLiquidity() {
  try {
    for (const [pair, address] of Object.entries(TRACKED_MARKETS)) {
      const marketAddress = new PublicKey(address);

      // Get market state
      const marketState = await connection.getAccountInfo(marketAddress);
      if (!marketState) continue;

      // Load Serum market
      const market = await Market.load(connection, marketAddress, {}, DEX_PROGRAMS.SERUM);

      // Get orderbook
      const bids = await market.loadBids(connection);
      const asks = await market.loadAsks(connection);

      // Calculate liquidity metrics
      const bidDepth = calculateOrderbookDepth(bids);
      const askDepth = calculateOrderbookDepth(asks);
      const spread = calculateSpread(bids, asks);

      // Get recent trades
      const trades = await market.loadFills(connection, 100);

      const marketInfo = {
        pair,
        address: address,
        timestamp: new Date().toISOString(),
        metrics: {
          bidDepth: bidDepth.toString(),
          askDepth: askDepth.toString(),
          spread: spread.toString(),
          lastPrice: trades[0]?.price.toString() || "0",
          volume24h: calculateVolume(trades),
          numOrders: bids.getL2(100).length + asks.getL2(100).length,
        },
        recentTrades: trades.slice(0, 10).map((trade) => ({
          price: trade.price.toString(),
          size: trade.size.toString(),
          side: trade.side,
          timestamp: new Date(trade.timestamp).toISOString(),
        })),
      };

      liquidityState.markets[pair] = marketInfo;

      // Store in Firebase
      await admin.firestore().collection("dex-liquidity").doc(pair).set(marketInfo);
    }

    liquidityState.lastUpdate = new Date().toISOString();
    logger.info("Liquidity monitoring cycle completed");
  } catch (error) {
    logger.error("Error monitoring liquidity:", error);
  }
}

// Helper functions
function calculateOrderbookDepth(orderbook) {
  let depth = new Decimal(0);
  const levels = orderbook.getL2(100);

  levels.forEach(([price, size]) => {
    depth = depth.plus(new Decimal(price).times(size));
  });

  return depth;
}

function calculateSpread(bids, asks) {
  const bestBid = bids.getL2(1)[0]?.[0] || 0;
  const bestAsk = asks.getL2(1)[0]?.[0] || 0;

  if (bestBid === 0 || bestAsk === 0) return new Decimal(0);

  return new Decimal(bestAsk).minus(bestBid).div(bestBid).times(100); // Convert to percentage
}

function calculateVolume(trades) {
  return trades.reduce((acc, trade) => acc.plus(new Decimal(trade.price).times(trade.size)), new Decimal(0));
}

// API endpoints
app.get("/liquidity/markets", (req, res) => {
  res.json({
    success: true,
    lastUpdate: liquidityState.lastUpdate,
    markets: liquidityState.markets,
  });
});

app.get("/liquidity/market/:pair", (req, res) => {
  const { pair } = req.params;
  const marketInfo = liquidityState.markets[pair];

  if (!marketInfo) {
    return res.status(404).json({
      success: false,
      error: "Market not found",
    });
  }

  res.json({
    success: true,
    market: marketInfo,
  });
});

// Start monitoring
const MONITORING_INTERVAL = 30000; // 30 seconds
setInterval(monitorMarketLiquidity, MONITORING_INTERVAL);

// Start the server
app.listen(port, () => {
  logger.info(`DEX liquidity monitor started on port ${port}`);
  monitorMarketLiquidity(); // Initial monitoring
});

// Handle graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received. Shutting down...");
  process.exit(0);
});
