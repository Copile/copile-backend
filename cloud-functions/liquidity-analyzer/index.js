const functions = require("@google-cloud/functions-framework");
const { Connection, PublicKey } = require("@solana/web3.js");
const { Market } = require("@project-serum/serum");
const { Liquidity } = require("@raydium-io/raydium-sdk");
const admin = require("firebase-admin");
const NodeCache = require("node-cache");
const Decimal = require("decimal.js");

admin.initializeApp();
const cache = new NodeCache({ stdTTL: 300 }); // 5 minute cache

const connection = new Connection("https://api.mainnet-beta.solana.com");

// Common DEX program IDs
const DEX_PROGRAMS = {
  SERUM: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
  RAYDIUM: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
  JUPITER: "JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB",
};

functions.http("analyzeLiquidity", async (req, res) => {
  try {
    const { market, timeframe = "1h" } = req.query;
    if (!market) {
      return res.status(400).json({ error: "Market address is required" });
    }

    const cacheKey = `liquidity-${market}-${timeframe}`;
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
      return res.json(cachedResult);
    }

    const marketPubkey = new PublicKey(market);

    // Get market state
    const marketState = await connection.getAccountInfo(marketPubkey);
    if (!marketState) {
      return res.status(404).json({ error: "Market not found" });
    }

    // Analyze recent trades to understand liquidity patterns
    const signatures = await connection.getSignaturesForAddress(marketPubkey, {
      limit: 100,
    });

    const trades = await Promise.all(
      signatures.map(async (sig) => {
        const tx = await connection.getTransaction(sig.signature);
        if (!tx) return null;

        return {
          signature: sig.signature,
          timestamp: sig.blockTime,
          preBalances: tx.meta.preBalances,
          postBalances: tx.meta.postBalances,
          programIds: tx.transaction.message
            .programIds()
            .map((id) => id.toString()),
        };
      })
    );

    // Calculate liquidity metrics
    let totalVolume = new Decimal(0);
    let largestTrade = new Decimal(0);
    let tradeCount = 0;

    trades.filter(Boolean).forEach((trade) => {
      const volume = new Decimal(
        Math.abs(trade.preBalances[0] - trade.postBalances[0])
      );
      totalVolume = totalVolume.plus(volume);
      largestTrade = Decimal.max(largestTrade, volume);
      tradeCount++;
    });

    // Analyze DEX usage
    const dexUsage = trades.filter(Boolean).reduce((acc, trade) => {
      trade.programIds.forEach((id) => {
        if (id === DEX_PROGRAMS.SERUM) acc.serum = (acc.serum || 0) + 1;
        if (id === DEX_PROGRAMS.RAYDIUM) acc.raydium = (acc.raydium || 0) + 1;
        if (id === DEX_PROGRAMS.JUPITER) acc.jupiter = (acc.jupiter || 0) + 1;
      });
      return acc;
    }, {});

    const analysis = {
      market,
      metrics: {
        totalVolume: totalVolume.toString(),
        averageTradeSize: totalVolume.div(tradeCount || 1).toString(),
        largestTrade: largestTrade.toString(),
        tradeCount,
        dexUsage,
      },
      timeframe,
      timestamp: new Date().toISOString(),
    };

    cache.set(cacheKey, analysis);

    res.json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error("Error analyzing liquidity:", error);
    res.status(500).json({ error: "Failed to analyze liquidity" });
  }
});
