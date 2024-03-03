const Firestore = require("@google-cloud/firestore");
const db = new Firestore();

const express = require("express");
const applyMiddleware = require("./middleware");
const app = express();
applyMiddleware(app);

app.get("/trades", async (req, res) => {
  console.log("Received request for /trades with body:", req.body);
  const tradeIds = req.query.ids.split(",");
  const traderId = req.get("traderId");

  try {
    const tradesRef = db.collectionGroup("trades");

    // Map each tradeId to a promise that queries for that tradeId
    const tradeQueries = tradeIds.map((tradeId) => {
      console.log(`Looking for trades with tradeID: ${tradeId}`);
      return tradesRef.where("tradeID", "==", tradeId).get();
    });

    // Wait for all queries to complete
    const results = await Promise.all(tradeQueries);

    // Process each query result
    const trades = [];
    results.forEach((tradeQuery, index) => {
      const tradeId = tradeIds[index];
      console.log(`Found ${tradeQuery.docs.length} trades with tradeID: ${tradeId}`);

      tradeQuery.docs.forEach((doc) => {
        const parentId = doc.ref.parent.parent.id;
        console.log(`Processing trade with parentId: ${parentId} and traderId: ${traderId}`);

        if (parentId !== traderId) {
          console.log(
            `Trade with parentId: ${parentId} is NOT equal to traderId: ${traderId}, adding to response`
          );

          const accountNickname = doc.ref.parent.parent.nickname;

          const tradeData = {
            ...doc.data(),
            account_nickname: accountNickname,
          };
          trades.push(tradeData);
        } else {
          console.log(`Trade with parentId: ${parentId} is equal to traderId: ${traderId}, skipping`);
        }
      });
    });

    console.log(`Sending response with meta_trades:`, trades);
    res.status(200).json(trades);
  } catch (error) {
    console.error("Error fetching meta trades:", error);
    res.status(500).send("Error fetching meta trades");
  }
});

app.get("/", (req, res) => {
  res.send("Copile Trader API");
});

app.get("*", (req, res) => {
  return res.status(400).send("Not Authorized");
});

module.exports = {
  metatrades: app,
};
