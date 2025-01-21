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

// Market making patterns to look for
const MM_PATTERNS = {
  MIN_TRADES_PER_HOUR: 10,
  MAX_TIME_BETWEEN_TRADES: 360, // 6 minutes
  MIN_SUCCESS_RATE: 0.95,
  MIN_QUOTE_REFRESH: 20, // Minimum quote refreshes per hour
};

functions.http("detectMarketMakers", async (req, res) => {
  try {
    const { walletAddress, timeframe = "24h" } = req.query;
    if (!walletAddress) {
      return res.status(400).json({ error: "Wallet address is required" });
    }

    const cacheKey = `mm-${walletAddress}-${timeframe}`;
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
      return res.json(cachedResult);
    }

    const pubkey = new PublicKey(walletAddress);

    // Get recent transaction history
    const signatures = await connection.getSignaturesForAddress(pubkey, {
      limit: 1000,
    });

    // Analyze transaction patterns
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
        };
      })
    );

    const validTxs = transactions.filter(Boolean);

    // Analyze trading patterns
    const analysis = {
      totalTransactions: validTxs.length,
      successRate: validTxs.filter((tx) => tx.success).length / validTxs.length,
      tradingPatterns: {},
      quoteRefreshes: 0,
      marketMakingScore: 0,
    };

    // Analyze time between trades
    const timestamps = validTxs.map((tx) => tx.timestamp).sort((a, b) => a - b);
    const timeGaps = [];
    for (let i = 1; i < timestamps.length; i++) {
      timeGaps.push(timestamps[i] - timestamps[i - 1]);
    }

    analysis.tradingPatterns = {
      averageTimeBetweenTrades:
        timeGaps.reduce((a, b) => a + b, 0) / timeGaps.length,
      maxTimeBetweenTrades: Math.max(...timeGaps),
      tradesPerHour:
        validTxs.length /
        ((timestamps[timestamps.length - 1] - timestamps[0]) / 3600),
    };

    // Count quote refreshes (order book updates)
    analysis.quoteRefreshes = validTxs.filter((tx) =>
      tx.programIds.some(
        (id) =>
          id === "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin" || // Serum
          id === "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8" // Raydium
      )
    ).length;

    // Calculate market making score
    let score = 0;
    if (
      analysis.tradingPatterns.tradesPerHour >= MM_PATTERNS.MIN_TRADES_PER_HOUR
    )
      score += 25;
    if (
      analysis.tradingPatterns.maxTimeBetweenTrades <=
      MM_PATTERNS.MAX_TIME_BETWEEN_TRADES
    )
      score += 25;
    if (analysis.successRate >= MM_PATTERNS.MIN_SUCCESS_RATE) score += 25;
    if (analysis.quoteRefreshes / 24 >= MM_PATTERNS.MIN_QUOTE_REFRESH)
      score += 25;

    analysis.marketMakingScore = score;
    analysis.isLikelyMarketMaker = score >= 75;

    // Get MEV stats from Jito
    const mevStats = await jitoClient.getRecentBlockProduction();
    analysis.mevActivity = {
      totalBlocks: mevStats?.total || 0,
      jitoBlocks: mevStats?.jitoBlocks || 0,
    };

    cache.set(cacheKey, analysis);

    res.json({
      success: true,
      walletAddress,
      analysis,
    });
  } catch (error) {
    console.error("Error detecting market makers:", error);
    res.status(500).json({ error: "Failed to detect market makers" });
  }
});
