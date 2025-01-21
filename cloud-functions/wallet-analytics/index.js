const functions = require("@google-cloud/functions-framework");
const { Connection, PublicKey } = require("@solana/web3.js");
const { Market } = require("@project-serum/serum");
const { JitoRpcClient } = require("@jito-labs/jito-ts");
const admin = require("firebase-admin");
const NodeCache = require("node-cache");
const Decimal = require("decimal.js");

admin.initializeApp();

const cache = new NodeCache({ stdTTL: 300 });

const connection = new Connection(
  process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com"
);

const jitoClient = new JitoRpcClient(
  process.env.JITO_RPC_URL || "https://jito-api.mainnet-beta.solana.com"
);

const PROGRAM_IDS = {
  DEX: {
    SERUM: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
    RAYDIUM: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
    JUPITER: "JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB",
  },
  LENDING: {
    SOLEND: "So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo",
    MANGO: "mv3ekLzLbnVPNxjSKvqBpU3ZeZXPQdEC3bp5MDEBG68",
  },
  STAKING: {
    MARINADE: "MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD",
    LIDO: "LidoStake268hsy8Kf58CtYpD3XtMtSXqbMg4wHzwGf",
  },
};

functions.http("analyzeWallet", async (req, res) => {
  try {
    const { wallet, timeframe = "7d" } = req.query;

    if (!wallet) {
      return res.status(400).json({
        success: false,
        error: "Wallet address is required",
      });
    }

    const cacheKey = `wallet-${wallet}-${timeframe}`;
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

    const analytics = {
      wallet,
      timeframe,
      totalTransactions: recentSignatures.length,
      transactionTypes: {
        dex: 0,
        lending: 0,
        staking: 0,
        other: 0,
      },
      volume: {
        total: new Decimal(0),
        byDex: {
          serum: new Decimal(0),
          raydium: new Decimal(0),
          jupiter: new Decimal(0),
        },
      },
      tradingPatterns: {
        averageSize: new Decimal(0),
        largestTrade: new Decimal(0),
        tradingFrequency: 0,
        preferredDex: null,
      },
      riskMetrics: {
        leverageUsed: false,
        liquidationEvents: 0,
        failedTransactions: 0,
      },
      timestamp: new Date().toISOString(),
    };

    for (const sig of recentSignatures) {
      try {
        const tx = await connection.getTransaction(sig.signature);
        if (!tx) continue;

        const programIds = tx.transaction.message.accountKeys.map((key) =>
          key.toString()
        );

        const volume = new Decimal(
          Math.abs(tx.meta.preBalances[0] - tx.meta.postBalances[0])
        );

        analytics.volume.total = analytics.volume.total.plus(volume);

        if (
          programIds.some((id) => Object.values(PROGRAM_IDS.DEX).includes(id))
        ) {
          analytics.transactionTypes.dex++;

          if (programIds.includes(PROGRAM_IDS.DEX.SERUM)) {
            analytics.volume.byDex.serum =
              analytics.volume.byDex.serum.plus(volume);
          }
          if (programIds.includes(PROGRAM_IDS.DEX.RAYDIUM)) {
            analytics.volume.byDex.raydium =
              analytics.volume.byDex.raydium.plus(volume);
          }
          if (programIds.includes(PROGRAM_IDS.DEX.JUPITER)) {
            analytics.volume.byDex.jupiter =
              analytics.volume.byDex.jupiter.plus(volume);
          }

          if (volume.gt(analytics.tradingPatterns.largestTrade)) {
            analytics.tradingPatterns.largestTrade = volume;
          }
        } else if (
          programIds.some((id) =>
            Object.values(PROGRAM_IDS.LENDING).includes(id)
          )
        ) {
          analytics.transactionTypes.lending++;
          analytics.riskMetrics.leverageUsed = true;
        } else if (
          programIds.some((id) =>
            Object.values(PROGRAM_IDS.STAKING).includes(id)
          )
        ) {
          analytics.transactionTypes.staking++;
        } else {
          analytics.transactionTypes.other++;
        }

        if (!tx.meta.err) {
          analytics.riskMetrics.failedTransactions++;
        }
      } catch (error) {
        console.error("Error processing transaction:", error);
        continue;
      }
    }

    if (analytics.transactionTypes.dex > 0) {
      analytics.tradingPatterns.averageSize = analytics.volume.total.div(
        analytics.transactionTypes.dex
      );
      analytics.tradingPatterns.tradingFrequency =
        (analytics.transactionTypes.dex * 86400) / timeframeInSeconds;

      const dexVolumes = [
        { dex: "serum", volume: analytics.volume.byDex.serum },
        { dex: "raydium", volume: analytics.volume.byDex.raydium },
        { dex: "jupiter", volume: analytics.volume.byDex.jupiter },
      ];
      analytics.tradingPatterns.preferredDex = dexVolumes.reduce((a, b) =>
        a.volume.gt(b.volume) ? a : b
      ).dex;
    }

    const response = {
      ...analytics,
      volume: {
        total: analytics.volume.total.toString(),
        byDex: {
          serum: analytics.volume.byDex.serum.toString(),
          raydium: analytics.volume.byDex.raydium.toString(),
          jupiter: analytics.volume.byDex.jupiter.toString(),
        },
      },
      tradingPatterns: {
        ...analytics.tradingPatterns,
        averageSize: analytics.tradingPatterns.averageSize.toString(),
        largestTrade: analytics.tradingPatterns.largestTrade.toString(),
      },
    };

    await admin
      .firestore()
      .collection("wallet-analytics")
      .doc(`${wallet}-${timeframe}`)
      .set(response);

    cache.set(cacheKey, response);

    res.json({
      success: true,
      data: response,
      fromCache: false,
    });
  } catch (error) {
    console.error("Error analyzing wallet:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});
