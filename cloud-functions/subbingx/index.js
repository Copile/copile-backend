const Firestore = require("@google-cloud/firestore");
const db = new Firestore();

const express = require("express");
const applyMiddleware = require("./middleware");
const app = express();
applyMiddleware(app);

app.get("/trades", async (req, res) => {
  console.log("Received request for /trades with query parameters:", req.query);
  const tradeIds = req.query.ids.split(",");
  const traderId = req.get("traderId");
  console.log(`Extracted tradeIds: ${tradeIds} and traderId: ${traderId} from request`);

  try {
    const tradesRef = db.collectionGroup("trades");
    console.log("Preparing to query trades collection group");
    const tradeQueries = tradeIds.map((tradeId) => {
      console.log(`Querying for tradeID: ${tradeId}`);
      return tradesRef.where("tradeID", "==", tradeId).get();
    });
    const results = await Promise.all(tradeQueries);
    console.log("Completed querying for trades");

    const trades = await Promise.all(
      results.flatMap((tradeQuery) =>
        tradeQuery.docs.map(async (doc) => {
          const parentId = doc.ref.parent.parent.id;
          console.log(`Processing trade with parentId: ${parentId} and comparing with traderId: ${traderId}`);
          if (parentId === traderId) {
            console.log(`Master trade found, skipping master trade with parent id: ${parentId}`);
            return null; // Skip main master trade
          }

          const trade = doc.data();
          console.log(`Initializing stop-losses and take-profits arrays for tradeID: ${trade.tradeID}`);
          trade["stop-losses"] = []; // Initialize arrays
          trade["take-profits"] = [];

          const [stopLosses, takeProfits] = await Promise.all([
            doc.ref.collection("stop-losses").get(),
            doc.ref.collection("take-profits").get(),
          ]);

          console.log(`Adding stop-losses and take-profits to tradeID: ${trade.tradeID}`);
          stopLosses.forEach((stopLoss) => trade["stop-losses"].push(stopLoss.data()));
          takeProfits.forEach((takeProfit) => trade["take-profits"].push(takeProfit.data()));

          return trade;
        })
      )
    );

    // Filter out null values (main master trades)
    const filteredTrades = trades.filter((trade) => trade !== null);
    console.log(`Filtered out main master trades. Preparing to send ${filteredTrades.length} trades`);

    res.status(200).json(filteredTrades);
  } catch (error) {
    console.error("Error fetching sub bingx trades:", error);
    res.status(500).send("Error fetching sub bingx trades");
  }
});

app.get("/", (req, res) => {
  res.send("Copile Trader API");
});

app.get("*", (req, res) => {
  return res.status(400).send("Not Authorized");
});

module.exports = {
  subbingx: app,
};
