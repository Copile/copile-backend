const functions = require("@google-cloud/functions-framework");
const { Connection, PublicKey } = require("@solana/web3.js");
const { JitoRpcClient } = require("@jito-labs/jito-ts");
const admin = require("firebase-admin");
const NodeCache = require("node-cache");
const Decimal = require("decimal.js");

admin.initializeApp();
const cache = new NodeCache({ stdTTL: 300 }); // 5 minute cache

const connection = new Connection("https://api.mainnet-beta.solana.com");
const jitoClient = new JitoRpcClient(
  "https://jito-api.mainnet-beta.solana.com"
);

// Known program IDs for analysis
const PROGRAMS = {
  SERUM_DEX: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
  RAYDIUM_AMM: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
  JUPITER_AGG: "JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB",
  MARINADE: "MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD",
  LIDO: "CrX7kMhLC3cSsXJdT7JDgqrRVWGnUpX3gfEfxxU2NVLi",
};

functions.http("analyzeTransactions", async (req, res) => {
  try {
    const { address, type = "wallet", timeframe = "24h" } = req.query;
    if (!address) {
      return res.status(400).json({ error: "Address is required" });
    }

    const cacheKey = `tx-${address}-${type}-${timeframe}`;
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
      return res.json(cachedResult);
    }

    const pubkey = new PublicKey(address);

    // Get transaction history
    const signatures = await connection.getSignaturesForAddress(pubkey, {
      limit: 1000,
    });

    // Analyze transactions
    const transactions = await Promise.all(
      signatures.map(async (sig) => {
        const tx = await connection.getTransaction(sig.signature);
        if (!tx) return null;

        return {
          signature: sig.signature,
          timestamp: sig.blockTime,
          success: !tx.meta.err,
          programIds: tx.transaction.message
            .programIds()
            .map((id) => id.toString()),
          accountKeys: tx.transaction.message.accountKeys.map((key) =>
            key.toString()
          ),
          instructions: tx.transaction.message.instructions,
          preBalances: tx.meta.preBalances,
          postBalances: tx.meta.postBalances,
        };
      })
    );

    const validTxs = transactions.filter(Boolean);

    // Initialize analysis structure
    const analysis = {
      address,
      type,
      timeframe,
      overview: {
        totalTransactions: validTxs.length,
        successRate:
          validTxs.filter((tx) => tx.success).length / validTxs.length,
        uniquePrograms: new Set(validTxs.flatMap((tx) => tx.programIds)).size,
      },
      dexActivity: {
        serum: 0,
        raydium: 0,
        jupiter: 0,
      },
      stakingActivity: {
        marinade: 0,
        lido: 0,
      },
      volumeMetrics: {
        total: new Decimal(0),
        average: new Decimal(0),
        largest: new Decimal(0),
      },
      timeAnalysis: {
        firstTx: null,
        lastTx: null,
        averageTimeBetweenTxs: 0,
      },
      programUsage: {},
    };

    // Analyze transactions
    validTxs.forEach((tx) => {
      // Track program usage
      tx.programIds.forEach((id) => {
        analysis.programUsage[id] = (analysis.programUsage[id] || 0) + 1;

        // Track DEX activity
        if (id === PROGRAMS.SERUM_DEX) analysis.dexActivity.serum++;
        if (id === PROGRAMS.RAYDIUM_AMM) analysis.dexActivity.raydium++;
        if (id === PROGRAMS.JUPITER_AGG) analysis.dexActivity.jupiter++;

        // Track staking activity
        if (id === PROGRAMS.MARINADE) analysis.stakingActivity.marinade++;
        if (id === PROGRAMS.LIDO) analysis.stakingActivity.lido++;
      });

      // Volume analysis
      const volume = new Decimal(
        Math.abs(tx.postBalances[0] - tx.preBalances[0])
      );
      analysis.volumeMetrics.total = analysis.volumeMetrics.total.plus(volume);
      analysis.volumeMetrics.largest = Decimal.max(
        analysis.volumeMetrics.largest,
        volume
      );
    });

    // Calculate averages and time metrics
    analysis.volumeMetrics.average = analysis.volumeMetrics.total.div(
      validTxs.length || 1
    );

    const timestamps = validTxs.map((tx) => tx.timestamp).sort((a, b) => a - b);
    if (timestamps.length > 0) {
      analysis.timeAnalysis.firstTx = new Date(
        timestamps[0] * 1000
      ).toISOString();
      analysis.timeAnalysis.lastTx = new Date(
        timestamps[timestamps.length - 1] * 1000
      ).toISOString();

      let totalGap = 0;
      for (let i = 1; i < timestamps.length; i++) {
        totalGap += timestamps[i] - timestamps[i - 1];
      }
      analysis.timeAnalysis.averageTimeBetweenTxs =
        totalGap / (timestamps.length - 1);
    }

    // Get MEV stats if relevant
    if (analysis.dexActivity.serum > 0 || analysis.dexActivity.raydium > 0) {
      const mevStats = await jitoClient.getRecentBlockProduction();
      analysis.mevActivity = {
        totalBlocks: mevStats?.total || 0,
        jitoBlocks: mevStats?.jitoBlocks || 0,
      };
    }

    // Format numbers for output
    analysis.volumeMetrics.total = analysis.volumeMetrics.total.toString();
    analysis.volumeMetrics.average = analysis.volumeMetrics.average.toString();
    analysis.volumeMetrics.largest = analysis.volumeMetrics.largest.toString();

    cache.set(cacheKey, analysis);

    res.json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error("Error analyzing transactions:", error);
    res.status(500).json({ error: "Failed to analyze transactions" });
  }
});
