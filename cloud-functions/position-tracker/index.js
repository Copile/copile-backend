const functions = require("@google-cloud/functions-framework");
const { Connection, PublicKey } = require("@solana/web3.js");
const { Market } = require("@project-serum/serum");
const { Liquidity } = require("@raydium-io/raydium-sdk");
const admin = require("firebase-admin");
const NodeCache = require("node-cache");
const Decimal = require("decimal.js");

admin.initializeApp();
const cache = new NodeCache({ stdTTL: 60 }); // 1 minute cache

const connection = new Connection("https://api.mainnet-beta.solana.com");

// Common DEX program IDs and token programs
const PROGRAMS = {
  SERUM_DEX: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
  RAYDIUM_AMM: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
  JUPITER_AGG: "JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB",
  TOKEN_PROGRAM: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
};

functions.http("trackPositions", async (req, res) => {
  try {
    const { walletAddress } = req.query;
    if (!walletAddress) {
      return res.status(400).json({ error: "Wallet address is required" });
    }

    const cacheKey = `positions-${walletAddress}`;
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
      return res.json(cachedResult);
    }

    const pubkey = new PublicKey(walletAddress);

    // Get all token accounts owned by the wallet
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      pubkey,
      {
        programId: new PublicKey(PROGRAMS.TOKEN_PROGRAM),
      }
    );

    // Get recent transactions to analyze position changes
    const signatures = await connection.getSignaturesForAddress(pubkey, {
      limit: 100,
    });

    const transactions = await Promise.all(
      signatures.map(async (sig) => {
        const tx = await connection.getTransaction(sig.signature);
        if (!tx) return null;

        return {
          signature: sig.signature,
          timestamp: sig.blockTime,
          programIds: tx.transaction.message
            .programIds()
            .map((id) => id.toString()),
          accountKeys: tx.transaction.message.accountKeys.map((key) =>
            key.toString()
          ),
          preBalances: tx.meta.preBalances,
          postBalances: tx.meta.postBalances,
        };
      })
    );

    // Analyze positions across different DEXes
    const positions = {
      tokens: tokenAccounts.value.map((account) => ({
        mint: account.account.data.parsed.info.mint,
        amount: account.account.data.parsed.info.tokenAmount.uiAmount,
        decimals: account.account.data.parsed.info.tokenAmount.decimals,
      })),
      recentActivity: [],
      dexPositions: {
        serum: [],
        raydium: [],
        jupiter: [],
      },
    };

    // Analyze recent position changes
    transactions.filter(Boolean).forEach((tx) => {
      const positionChange = {
        timestamp: tx.timestamp,
        dex: tx.programIds.find(
          (id) =>
            id === PROGRAMS.SERUM_DEX ||
            id === PROGRAMS.RAYDIUM_AMM ||
            id === PROGRAMS.JUPITER_AGG
        ),
        balanceChange: new Decimal(
          tx.postBalances[0] - tx.preBalances[0]
        ).toString(),
      };

      if (positionChange.dex) {
        positions.recentActivity.push(positionChange);

        // Categorize by DEX
        if (positionChange.dex === PROGRAMS.SERUM_DEX) {
          positions.dexPositions.serum.push(positionChange);
        } else if (positionChange.dex === PROGRAMS.RAYDIUM_AMM) {
          positions.dexPositions.raydium.push(positionChange);
        } else if (positionChange.dex === PROGRAMS.JUPITER_AGG) {
          positions.dexPositions.jupiter.push(positionChange);
        }
      }
    });

    // Calculate position metrics
    const metrics = {
      totalPositions: positions.tokens.length,
      activePositions: positions.tokens.filter((t) => t.amount > 0).length,
      dexActivity: {
        serum: positions.dexPositions.serum.length,
        raydium: positions.dexPositions.raydium.length,
        jupiter: positions.dexPositions.jupiter.length,
      },
      lastUpdated: new Date().toISOString(),
    };

    const analysis = {
      walletAddress,
      positions,
      metrics,
    };

    cache.set(cacheKey, analysis);

    res.json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error("Error tracking positions:", error);
    res.status(500).json({ error: "Failed to track positions" });
  }
});
