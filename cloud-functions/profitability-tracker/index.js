const functions = require("@google-cloud/functions-framework");
const { Connection, PublicKey } = require("@solana/web3.js");
const { Market } = require("@project-serum/serum");
const { JitoRpcClient } = require("@jito-labs/jito-ts");
const admin = require("firebase-admin");
const NodeCache = require("node-cache");
const Decimal = require("decimal.js");

admin.initializeApp();
const cache = new NodeCache({ stdTTL: 300 }); // 5 minute cache

const connection = new Connection(
  process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com"
);
const jitoClient = new JitoRpcClient(
  process.env.JITO_RPC_URL || "https://jito-api.mainnet-beta.solana.com"
);

// Known program IDs
const PROGRAM_IDS = {
  DEX: {
    SERUM: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
    RAYDIUM: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
    JUPITER: "JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB",
  },
};

functions.http("trackProfitability", async (req, res) => {
  try {
    const { wallet, timeframe = "7d", market } = req.query;

    if (!wallet) {
      return res.status(400).json({
        success: false,
        error: "Wallet address is required",
      });
    }

    const cacheKey = `profit-${wallet}-${timeframe}-${market || "all"}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json({
        success: true,
        data: cachedData,
        fromCache: true,
      });
    }

    const now = Math.floor(Date.now() / 1000);
    const timeframeInSeconds =
      {
        "1h": 3600,
        "24h": 86400,
        "7d": 604800,
        "30d": 2592000,
      }[timeframe] || 604800;

    const signatures = await connection.getSignaturesForAddress(
      new PublicKey(wallet),
      { limit: 1000 }
    );

    const recentSignatures = signatures.filter(
      (sig) => now - sig.blockTime < timeframeInSeconds
    );

    const profitMetrics = {
      wallet,
      timeframe,
      market: market || "all",
      trades: {
        total: 0,
        profitable: 0,
        unprofitable: 0,
      },
      volume: {
        total: new Decimal(0),
        profitable: new Decimal(0),
        unprofitable: new Decimal(0),
      },
      pnl: {
        total: new Decimal(0),
        realized: new Decimal(0),
        unrealized: new Decimal(0),
        byDex: {
          serum: new Decimal(0),
          raydium: new Decimal(0),
          jupiter: new Decimal(0),
        },
      },
      metrics: {
        winRate: 0,
        averageProfit: new Decimal(0),
        averageLoss: new Decimal(0),
        largestProfit: new Decimal(0),
        largestLoss: new Decimal(0),
        profitFactor: 0,
      },
      positions: [],
      timestamp: new Date().toISOString(),
    };

    const openPositions = new Map();

    for (const sig of recentSignatures) {
      try {
        const tx = await connection.getTransaction(sig.signature);
        if (!tx) continue;

        const programIds = tx.transaction.message.accountKeys.map((key) =>
          key.toString()
        );

        const isDexTx = programIds.some((id) =>
          Object.values(PROGRAM_IDS.DEX).includes(id)
        );
        if (!isDexTx) continue;

        const preBalance = new Decimal(tx.meta.preBalances[0]);
        const postBalance = new Decimal(tx.meta.postBalances[0]);
        const impact = postBalance.minus(preBalance);
        const volume = new Decimal(Math.abs(impact));

        profitMetrics.volume.total = profitMetrics.volume.total.plus(volume);
        profitMetrics.trades.total++;

        if (programIds.includes(PROGRAM_IDS.DEX.SERUM)) {
          profitMetrics.pnl.byDex.serum =
            profitMetrics.pnl.byDex.serum.plus(impact);
        }
        if (programIds.includes(PROGRAM_IDS.DEX.RAYDIUM)) {
          profitMetrics.pnl.byDex.raydium =
            profitMetrics.pnl.byDex.raydium.plus(impact);
        }
        if (programIds.includes(PROGRAM_IDS.DEX.JUPITER)) {
          profitMetrics.pnl.byDex.jupiter =
            profitMetrics.pnl.byDex.jupiter.plus(impact);
        }

        if (impact.gt(0)) {
          profitMetrics.trades.profitable++;
          profitMetrics.volume.profitable =
            profitMetrics.volume.profitable.plus(volume);
          profitMetrics.pnl.realized = profitMetrics.pnl.realized.plus(impact);

          if (impact.gt(profitMetrics.metrics.largestProfit)) {
            profitMetrics.metrics.largestProfit = impact;
          }
        } else if (impact.lt(0)) {
          profitMetrics.trades.unprofitable++;
          profitMetrics.volume.unprofitable =
            profitMetrics.volume.unprofitable.plus(volume);
          profitMetrics.pnl.realized = profitMetrics.pnl.realized.plus(impact);

          if (impact.lt(profitMetrics.metrics.largestLoss)) {
            profitMetrics.metrics.largestLoss = impact;
          }
        }

        profitMetrics.positions.push({
          signature: sig.signature,
          timestamp: new Date(sig.blockTime * 1000).toISOString(),
          type: impact.gt(0) ? "profit" : "loss",
          volume: volume.toString(),
          pnl: impact.toString(),
          dex: programIds.find((id) =>
            Object.values(PROGRAM_IDS.DEX).includes(id)
          ),
        });
      } catch (error) {
        console.error("Error processing transaction:", error);
        continue;
      }
    }

    if (profitMetrics.trades.total > 0) {
      profitMetrics.metrics.winRate =
        (profitMetrics.trades.profitable / profitMetrics.trades.total) * 100;

      if (profitMetrics.trades.profitable > 0) {
        profitMetrics.metrics.averageProfit = profitMetrics.pnl.realized.div(
          profitMetrics.trades.profitable
        );
      }

      if (profitMetrics.trades.unprofitable > 0) {
        profitMetrics.metrics.averageLoss = profitMetrics.pnl.realized.div(
          profitMetrics.trades.unprofitable
        );
      }

      if (profitMetrics.volume.unprofitable.gt(0)) {
        profitMetrics.metrics.profitFactor = profitMetrics.volume.profitable
          .div(profitMetrics.volume.unprofitable)
          .toNumber();
      }
    }

    profitMetrics.pnl.total = profitMetrics.pnl.realized.plus(
      profitMetrics.pnl.unrealized
    );

    const response = {
      ...profitMetrics,
      volume: {
        total: profitMetrics.volume.total.toString(),
        profitable: profitMetrics.volume.profitable.toString(),
        unprofitable: profitMetrics.volume.unprofitable.toString(),
      },
      pnl: {
        total: profitMetrics.pnl.total.toString(),
        realized: profitMetrics.pnl.realized.toString(),
        unrealized: profitMetrics.pnl.unrealized.toString(),
        byDex: {
          serum: profitMetrics.pnl.byDex.serum.toString(),
          raydium: profitMetrics.pnl.byDex.raydium.toString(),
          jupiter: profitMetrics.pnl.byDex.jupiter.toString(),
        },
      },
      metrics: {
        ...profitMetrics.metrics,
        averageProfit: profitMetrics.metrics.averageProfit.toString(),
        averageLoss: profitMetrics.metrics.averageLoss.toString(),
        largestProfit: profitMetrics.metrics.largestProfit.toString(),
        largestLoss: profitMetrics.metrics.largestLoss.toString(),
      },
    };

    await admin
      .firestore()
      .collection("profitability-tracking")
      .doc(`${wallet}-${timeframe}-${market || "all"}`)
      .set(response);

    cache.set(cacheKey, response);

    res.json({
      success: true,
      data: response,
      fromCache: false,
    });
  } catch (error) {
    console.error("Error tracking profitability:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});
