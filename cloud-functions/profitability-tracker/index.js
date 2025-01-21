const functions = require("@google-cloud/functions-framework");
const { Connection, PublicKey } = require("@solana/web3.js");
const { JitoRpcClient } = require("@jito-labs/jito-ts");
const admin = require("firebase-admin");
const Decimal = require("decimal.js");
const NodeCache = require("node-cache");

admin.initializeApp();
const cache = new NodeCache({ stdTTL: 300 }); // 5 minute cache

const connection = new Connection("https://api.mainnet-beta.solana.com");
const jitoClient = new JitoRpcClient(
  "https://jito-api.mainnet-beta.solana.com"
);

functions.http("trackProfitability", async (req, res) => {
  try {
    const { walletAddress, timeframe } = req.query;
    if (!walletAddress) {
      return res.status(400).json({ error: "Wallet address is required" });
    }

    const cacheKey = `${walletAddress}-${timeframe || "24h"}`;
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
      return res.json(cachedResult);
    }

    const pubkey = new PublicKey(walletAddress);

    // Get historical transactions
    const signatures = await connection.getSignaturesForAddress(pubkey, {
      limit: 1000,
    });

    // Calculate PnL from transactions
    let totalPnL = new Decimal(0);
    let winningTrades = 0;
    let losingTrades = 0;

    const tradeAnalysis = await Promise.all(
      signatures.map(async (sig) => {
        const tx = await connection.getTransaction(sig.signature);
        if (!tx) return null;

        const preBalance = new Decimal(tx.meta.preBalances[0]);
        const postBalance = new Decimal(tx.meta.postBalances[0]);
        const pnl = postBalance.minus(preBalance);

        if (pnl.isPositive()) winningTrades++;
        if (pnl.isNegative()) losingTrades++;

        return {
          timestamp: sig.blockTime,
          pnl: pnl.toString(),
          signature: sig.signature,
          success: !tx.meta.err,
        };
      })
    );

    // Get MEV stats from Jito
    const mevStats = await jitoClient.getRecentBlockProduction();

    const metrics = {
      totalTrades: winningTrades + losingTrades,
      winRate: (winningTrades / (winningTrades + losingTrades)) * 100,
      profitFactor: winningTrades / (losingTrades || 1),
      mevOpportunities: mevStats ? mevStats.length : 0,
      recentTrades: tradeAnalysis.filter(Boolean).slice(0, 10),
    };

    cache.set(cacheKey, metrics);

    res.json({
      success: true,
      walletAddress,
      metrics,
    });
  } catch (error) {
    console.error("Error tracking profitability:", error);
    res.status(500).json({ error: "Failed to track profitability" });
  }
});
