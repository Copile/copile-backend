const functions = require("@google-cloud/functions-framework");
const { Connection, PublicKey } = require("@solana/web3.js");
const { JitoRpcClient, SearcherClient } = require("@jito-labs/jito-ts");
const admin = require("firebase-admin");
const NodeCache = require("node-cache");
const WebSocket = require("ws");

admin.initializeApp();
const cache = new NodeCache({ stdTTL: 60 }); // 1 minute cache

const connection = new Connection("https://api.mainnet-beta.solana.com");
const jitoClient = new JitoRpcClient(
  "https://jito-api.mainnet-beta.solana.com"
);

// In-memory store for active MEV opportunities
const mevOpportunities = new Map();

// WebSocket connection to Jito's block engine
let wsConnection = null;

const connectToJitoWs = () => {
  if (wsConnection) return;

  wsConnection = new WebSocket(
    "wss://jito-block-engine.mainnet-beta.solana.com"
  );

  wsConnection.on("open", () => {
    console.log("Connected to Jito block engine");
    // Subscribe to block data
    wsConnection.send(
      JSON.stringify({
        jsonrpc: "2.0",
        method: "blockSubscribe",
        params: ["all"],
        id: 1,
      })
    );
  });

  wsConnection.on("message", async (data) => {
    try {
      const block = JSON.parse(data);
      if (block.result && block.result.value) {
        await processBlock(block.result.value);
      }
    } catch (error) {
      console.error("Error processing block:", error);
    }
  });

  wsConnection.on("close", () => {
    console.log("Disconnected from Jito block engine");
    wsConnection = null;
    // Reconnect after 5 seconds
    setTimeout(connectToJitoWs, 5000);
  });
};

async function processBlock(block) {
  // Analyze transactions in the block for MEV opportunities
  const transactions = block.transactions || [];

  for (const tx of transactions) {
    const signature = tx.transaction.signatures[0];
    const programIds = tx.transaction.message.accountKeys.map((key) =>
      key.toString()
    );

    // Look for specific patterns that might indicate MEV
    const isMevOpportunity = programIds.some(
      (id) =>
        // Check for common DEX program IDs
        id === "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin" || // Serum v3
        id === "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8" || // Raydium
        id === "JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB" // Jupiter
    );

    if (isMevOpportunity) {
      mevOpportunities.set(signature, {
        signature,
        timestamp: new Date().toISOString(),
        programIds,
        blockHeight: block.parentSlot,
      });
    }
  }
}

functions.http("getMevOpportunities", async (req, res) => {
  try {
    const { timeframe } = req.query;
    const cacheKey = `mev-${timeframe || "1m"}`;

    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
      return res.json(cachedResult);
    }

    // Get recent MEV opportunities
    const recentMevs = Array.from(mevOpportunities.values())
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 100);

    // Get Jito block stats
    const blockStats = await jitoClient.getRecentBlockProduction();

    const analysis = {
      totalOpportunities: mevOpportunities.size,
      recentOpportunities: recentMevs,
      blockStats: {
        totalBlocks: blockStats?.total || 0,
        jitoBlocks: blockStats?.jitoBlocks || 0,
      },
      timestamp: new Date().toISOString(),
    };

    cache.set(cacheKey, analysis);

    res.json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error("Error getting MEV opportunities:", error);
    res.status(500).json({ error: "Failed to get MEV opportunities" });
  }
});

// Initialize WebSocket connection
connectToJitoWs();
