const Firestore = require("@google-cloud/firestore");
const db = new Firestore();
const express = require("express");
const applyMiddleware = require("./middleware");
const axios = require("axios");
const app = express();
applyMiddleware(app);

// Second endpoint: Forward traffic to "https://fapi.binance.com/fapi/v1/exchangeInfo?permissions=PERPETUAL"
app.get("/supportedExchanges", async (req, res) => {
  const trader = req.get("traderId");
  console.log(`Trader ID: ${trader}`);

  if (!trader) {
    console.log("Trader ID is missing");
    return res.status(400).json({ success: false, error: "Trader ID is missing" });
  }

  const traderRef = db.collection("traders").doc(trader);
  const traderDoc = await traderRef.get();

  if (!traderDoc.exists) {
    console.log("Trader not found");
    return res.status(404).json({ success: false, error: "Trader not found" });
  }

  const url = "https://fapi.binance.com/fapi/v1/exchangeInfo?permissions=PERPETUAL";
  console.log(`Fetching data from: ${url}`);

  try {
    const response = await axios.get(url);
    console.log(`Response data: ${JSON.stringify(response.data)}`);
    return res.json(response.data);
  } catch (error) {
    console.error(`Failed to fetch data from the external API: ${error}`);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch data from the external API",
    });
  }
});

app.get("*", (req, res) => {
  return res.status(400).send("Not Authorized");
});

exports.binance = app;
