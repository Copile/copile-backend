const express = require("express");
const { Firestore } = require("@google-cloud/firestore");
const { decryptData } = require("../utils/decryption");
const { BinanceSession } = require("../exchanges/binance/session");
const { KuCoinSession } = require("../exchanges/kucoin/session");
const { BingXSession } = require("../exchanges/bingx/session");

const router = express.Router();
const db = new Firestore();

router.get("/balance/:exchange", async (req, res) => {
  const trader_id = req.get("traderId");

  if (!trader_id) {
    return res
      .status(400)
      .json({ success: false, error: "Trader ID is missing" });
  }

  const exchange = req.params.exchange;

  if (exchange === "bybit") {
    return res.status(404).json({
      success: false,
      error: "Bybit is not supported by this endpoint",
    });
  }

  try {
    const startTime = Date.now();

    const traderRef = db.collection("traders").doc(trader_id);
    const traderDoc = await traderRef.get();

    if (!traderDoc.exists) {
      return res
        .status(404)
        .json({ success: false, error: "Trader not found" });
    }

    const exchangesData = traderDoc.data().exchanges || {};

    if (!exchangesData || !(exchange in exchangesData)) {
      return res
        .status(404)
        .json({ success: false, error: "No exchange found" });
    }

    const keys = exchangesData[exchange];
    if (!("api_key" in keys && keys.api_key !== "x")) {
      return res.status(404).json({
        success: false,
        error: "API key not found for the exchange",
      });
    }

    const apiKey = keys.api_key;
    const apiSecret = (await decryptData(keys.api_secret, trader_id)) || null;

    let apiPassphrase = null;
    if ("api_passphrase" in keys) {
      apiPassphrase = await decryptData(keys.api_passphrase, trader_id);
    }

    if (exchange === "kucoin" && apiPassphrase === null) {
      return res
        .status(400)
        .json({ success: false, error: "Kucoin requires a passphrase" });
    }

    let balance;

    switch (exchange) {
      case "kucoin":
        const kucoinSession = new KuCoinSession({
          apiKey,
          apiSecret,
          apiPassphrase,
        });
        balance = await kucoinSession.getBalance();
        break;
      case "bingx":
        const bingxSession = new BingXSession({ apiKey, apiSecret });
        balance = await bingxSession.getBalance();
        break;
      case "binance":
        const binanceSession = new BinanceSession({ apiKey, apiSecret });
        balance = await binanceSession.getBalance();
        break;
      default:
        console.log(`Unknown exchange: ${exchange}`);
        balance = [];
    }

    const endTime = Date.now();
    const executionTime = endTime - startTime;

    return res
      .status(200)
      .json({ success: true, balance: balance, executionTime });
  } catch (e) {
    return res.status(500).json({
      success: false,
      error: "An error occurred while fetching the balance details.",
    });
  }
});

module.exports = router;