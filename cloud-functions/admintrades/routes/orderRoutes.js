const express = require("express");
const { Firestore } = require("@google-cloud/firestore");

const { decryptData } = require("../utils/decryption");
const { getTradeProfitLossDetails } = require("../utils/utils");

const router = express.Router();
const db = new Firestore();

router.get("/order/:exchange/:symbol/:tradeId", async (req, res) => {
  try {
    console.log("Decrypt Data function: ", decryptData);
    const trader = req.get("traderId");

    if (!trader) {
      return res
        .status(400)
        .json({ success: false, error: "Trader name is missing" });
    }

    // Fetch userDoc and exchangesData in parallel
    const [userDoc, exchangesData] = await Promise.all([
      db.collection("traders").doc(trader).get(),
      db
        .collection("traders")
        .doc(trader)
        .get()
        .then((doc) => doc.data().exchanges || {}),
    ]);

    if (!userDoc.exists) {
      return res
        .status(404)
        .json({ success: false, error: "Trader not found" });
    }

    const tradeId = req.params.tradeId;
    const exchange = req.params.exchange;
    const symbol = req.params.symbol;

    if (exchange === "bybit") {
      return res.status(404).json({
        success: false,
        error: "Bybit is not supported by this endpoint",
      });
    }

    if (!exchangesData || !(exchange in exchangesData)) {
      return res
        .status(404)
        .json({ success: false, error: "No exchange found" });
    }

    const keys = exchangesData[exchange];
    if (!("api_key" in keys && keys.api_key !== "x")) {
      return res.status(401).json({
        success: false,
        error: "API key not found for the exchange",
      });
    }

    const apiKey = keys.api_key;
    const apiSecret = (await decryptData(keys.api_secret, trader)) || null;
    console.log("apiKey: ", apiKey);
    console.log("apiSecret: ", apiSecret);
    let apiPassphrase = null;
    if ("api_passphrase" in keys) {
      apiPassphrase = await decryptData(keys.api_passphrase, trader);
    }

    if (exchange === "kucoin" && !apiPassphrase) {
      return res
        .status(400)
        .json({ success: false, error: "Kucoin requires a passphrase" });
    }

    const details = await getTradeProfitLossDetails(
      trader,
      tradeId,
      exchange,
      symbol,
      apiKey,
      apiSecret,
      apiPassphrase
    );

    if (details) {
      res.json(details);
    } else {
      res.status(404).send(`Trade with ID ${tradeId} not found.`);
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      error: "An error occurred while fetching the trade details.",
    });
  }
});

module.exports = router;
