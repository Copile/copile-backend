const Firestore = require("@google-cloud/firestore");
const db = new Firestore();

const express = require("express");
const applyMiddleware = require("./middleware");
const app = express();
applyMiddleware(app);

app.get("/trades", async (req, res) => {
  const { tradeId, traderId } = req.body;

  try {
    const tradesRef = db.collectionGroup("trades");
    const tradeQuery = await tradesRef.where("tradeID", "==", tradeId).get();

    const trades = tradeQuery.docs.map((doc) => {
      const metaId = doc.ref.parent.parent.id;

      if (metaId !== traderId) {
        return {
          trade_id: tradeId,
          symbol: doc.data().symbol,
          type: doc.data().type,
          side: doc.data().side,
          quantity: doc.data().quantity,
          entry: doc.data().entry,
          margin: doc.data().margin,
          exchange: doc.data().exchange,
        };
      }
    });

    res.status(200).json({ meta_trades: trades });
  } catch (error) {
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
  trader: app,
};
