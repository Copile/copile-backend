const express = require("express");
const { Firestore } = require("@google-cloud/firestore");
const { decryptData } = require("../utils/decryption");
const KuCoinSession = require("../exchanges/kucoin/session");
const BingXSession = require("../exchanges/bingx/session");
const BinanceSession = require("../exchanges/binance/session");

const router = express.Router();
const db = new Firestore();

router.get("/trades/:exchange", async (req, res) => {
  try {
    console.log("Fetching trades...");
    console.log("Decrypt Data function: ", decryptData);
    const trader_id = req.get("traderId");
    const exchange = req.params.exchange;
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;

    if (!trader_id) {
      return res
        .status(400)
        .json({ success: false, error: "Trader name is missing" });
    }

    // Fetch userDoc and exchangesData in parallel
    const [userDoc, exchangesData] = await Promise.all([
      db.collection("traders").doc(trader_id).get(),
      db
        .collection("traders")
        .doc(trader_id)
        .get()
        .then((doc) => doc.data().exchanges || {}),
    ]);

    if (!userDoc.exists) {
      return res
        .status(404)
        .json({ success: false, error: "Trader not found" });
    }

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

    let trades;
    let orders;

    // Fetch trades and orders in parallel using Promise.all
    switch (exchange) {
      case "kucoin":
        const kucoinSession = new KuCoinSession(
          apiKey,
          apiSecret,
          apiPassphrase
        );
        [trades, orders] = await Promise.all([
          kucoinSession.getPositions(trader_id),
          kucoinSession.getOrders(trader_id),
        ]);
        break;
      case "bingx":
        const bingxSession = new BingXSession(apiKey, apiSecret);
        [trades, orders] = await Promise.all([
          bingxSession.getPositions(trader_id),
          bingxSession.getOrders(trader_id),
        ]);
        break;
      case "binance":
        console.log("Fetching Binance trades...");
        const binanceSession = new BinanceSession(apiKey, apiSecret);
        [trades, orders] = await Promise.all([
          binanceSession.getPositions(trader_id),
          binanceSession.getOrders(trader_id),
        ]);
        console.log("Binance trades fetched");
        console.log(trades);
        console.log(orders);
        break;
      default:
        console.log(`Unknown exchange: ${exchange}`);
        trades = [];
        orders = [];
    }

    // Pagination
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedTrades = trades.slice(start, end);

    return res.json({
      success: true,
      exchange,
      trades: paginatedTrades,
      orders,
    });
  } catch (e) {
    console.log("Error fetching trades: " + e);
    return res.status(500).json({
      success: false,
      error: "An error occurred while fetching the trade details.",
    });
  }
});

module.exports = router;