const functions = require("@google-cloud/functions-framework");
const { Connection, PublicKey } = require("@solana/web3.js");
const { JitoRpcClient } = require("@jito-labs/jito-ts");
const admin = require("firebase-admin");
const bs58 = require("bs58");

admin.initializeApp();

const connection = new Connection("https://api.mainnet-beta.solana.com");
const jitoClient = new JitoRpcClient(
  "https://jito-api.mainnet-beta.solana.com"
);

functions.http("analyzeWallet", async (req, res) => {
  try {
    const { walletAddress } = req.query;
    if (!walletAddress) {
      return res.status(400).json({ error: "Wallet address is required" });
    }

    const pubkey = new PublicKey(walletAddress);

    // Get recent transaction history
    const signatures = await connection.getSignaturesForAddress(pubkey, {
      limit: 100,
    });

    // Analyze transactions for copy trading patterns
    const txDetails = await Promise.all(
      signatures.map(async (sig) => {
        const tx = await connection.getTransaction(sig.signature);
        return {
          signature: sig.signature,
          timestamp: sig.blockTime,
          programIds: tx?.transaction.message
            .programIds()
            .map((id) => id.toString()),
          volume: tx?.meta?.preBalances[0] - tx?.meta?.postBalances[0] || 0,
        };
      })
    );

    // Get MEV opportunities from Jito
    const jitoBlockData = await jitoClient.getRecentBlockProduction();

    // Analyze wallet profitability
    const profitMetrics = {
      totalTransactions: txDetails.length,
      totalVolume: txDetails.reduce((acc, tx) => acc + tx.volume, 0),
      tradingPrograms: [
        ...new Set(txDetails.flatMap((tx) => tx.programIds || [])),
      ],
      mevOpportunities: jitoBlockData ? true : false,
    };

    res.json({
      success: true,
      walletAddress,
      analytics: profitMetrics,
      recentActivity: txDetails,
    });
  } catch (error) {
    console.error("Error analyzing wallet:", error);
    res.status(500).json({ error: "Failed to analyze wallet" });
  }
});
