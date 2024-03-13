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
      console.log(`Looking for trades with tradeID: ${tradeId}`);
      return tradesRef.where("tradeID", "==", tradeId).get();
    });

    const results = await Promise.all(tradeQueries);

    const mt5Trades = [];
    const subBingxTrades = [];

    await Promise.all(
      results.flatMap((tradeQuery) =>
        tradeQuery.docs.map(async (doc) => {
          const parentId = doc.ref.parent.parent.id;
          console.log(`Processing trade with parentId: ${parentId} and comparing with traderId: ${traderId}`);

          if (parentId === traderId) {
            console.log(
              `Trade with parentId: ${parentId} is equal to traderId: ${traderId}, skipping master trade`
            );
            return;
          }

          console.log(
            `Trade with parentId: ${parentId} is NOT equal to traderId: ${traderId}, extracting trade data`
          );
          const trade = doc.data();

          if (trade.exchange === "mt5") {
            console.log(`Trade is mt5, adding to mt5Trades array`);
            mt5Trades.push(trade);
          } else if (trade.exchange === "subbingx") {
            console.log(`Trade is subbingx, fetching stop-losses and take-profits`);
            trade["stop-losses"] = [];
            trade["take-profits"] = [];

            const [stopLosses, takeProfits] = await Promise.all([
              doc.ref.collection("stop-losses").get(),
              doc.ref.collection("take-profits").get(),
            ]);

            console.log(`Adding stop-losses and take-profits to subbingx trade`);
            stopLosses.forEach((stopLoss) => trade["stop-losses"].push(stopLoss.data()));
            takeProfits.forEach((takeProfit) => trade["take-profits"].push(takeProfit.data()));

            subBingxTrades.push(trade);
          }
        })
      )
    );

    console.log(
      `Preparing to send response with ${mt5Trades.length} mt5Trades and ${subBingxTrades.length} subBingxTrades`
    );
    res.status(200).json({ mt5Trades, subBingxTrades });
  } catch (error) {
    console.error("Error fetching trades:", error);
    res.status(500).send("Error fetching trades");
  }
});

app.get("/", (req, res) => {
  res.send("Copile Trader API");
});

app.get("*", (req, res) => {
  return res.status(400).send("Not Authorized");
});

module.exports = {
  distribution: app,
};
