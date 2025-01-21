const functions = require("@google-cloud/functions-framework");
const { Connection, PublicKey } = require("@solana/web3.js");
const { JitoRpcClient } = require("@jito-labs/jito-ts");
const admin = require("firebase-admin");
const NodeCache = require("node-cache");
const Decimal = require("decimal.js");

admin.initializeApp();
const cache = new NodeCache({ stdTTL: 300 }); // 5 minutes cache

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

// HTTP Cloud Function
functions.http("monitorMempool", async (req, res) => {
  try {
    // Get parameters from request
    const { timeframe = "5m" } = req.query;

    // Check cache first
    const cacheKey = `mempool-${timeframe}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json({
        success: true,
        data: cachedData,
        fromCache: true,
      });
    }

    // Get recent transactions from Jito mempool
    const searchTransactions = await jitoClient.searchMempoolTransactions({
      limit: 1000,
      filter: {
        programIds: Object.values(DEX_PROGRAMS),
      },
    });

    // Process transactions
    const mempoolStats = {
      totalTransactions: 0,
      byDex: {
        serum: 0,
        raydium: 0,
        jupiter: 0,
      },
      volumeStats: {
        total: new Decimal(0),
        byDex: {
          serum: new Decimal(0),
          raydium: new Decimal(0),
          jupiter: new Decimal(0),
        },
      },
      recentTransactions: [],
      timestamp: new Date().toISOString(),
    };

    // Process each transaction
    for (const tx of searchTransactions.transactions) {
      mempoolStats.totalTransactions++;

      const programIds = tx.transaction.message.accountKeys.map((key) =>
        key.toString()
      );
      const volume = new Decimal(
        Math.abs(tx.meta.preBalances[0] - tx.meta.postBalances[0])
      );

      // Update DEX-specific stats
      programIds.forEach((program) => {
        if (program === DEX_PROGRAMS.SERUM) {
          mempoolStats.byDex.serum++;
          mempoolStats.volumeStats.byDex.serum =
            mempoolStats.volumeStats.byDex.serum.plus(volume);
        } else if (program === DEX_PROGRAMS.RAYDIUM) {
          mempoolStats.byDex.raydium++;
          mempoolStats.volumeStats.byDex.raydium =
            mempoolStats.volumeStats.byDex.raydium.plus(volume);
        } else if (program === DEX_PROGRAMS.JUPITER) {
          mempoolStats.byDex.jupiter++;
          mempoolStats.volumeStats.byDex.jupiter =
            mempoolStats.volumeStats.byDex.jupiter.plus(volume);
        }
      });

      mempoolStats.volumeStats.total =
        mempoolStats.volumeStats.total.plus(volume);

      // Add to recent transactions
      mempoolStats.recentTransactions.push({
        signature: tx.transaction.signatures[0],
        programIds,
        volume: volume.toString(),
        timestamp: new Date().toISOString(),
      });
    }

    // Convert Decimal objects to strings for JSON serialization
    const response = {
      ...mempoolStats,
      volumeStats: {
        total: mempoolStats.volumeStats.total.toString(),
        byDex: {
          serum: mempoolStats.volumeStats.byDex.serum.toString(),
          raydium: mempoolStats.volumeStats.byDex.raydium.toString(),
          jupiter: mempoolStats.volumeStats.byDex.jupiter.toString(),
        },
      },
    };

    // Store in Firebase
    await admin
      .firestore()
      .collection("mempool-stats")
      .doc(new Date().toISOString())
      .set(response);

    // Cache the results
    cache.set(cacheKey, response);

    res.json({
      success: true,
      data: response,
      fromCache: false,
    });
  } catch (error) {
    console.error("Error monitoring mempool:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});
