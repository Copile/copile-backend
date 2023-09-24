const express = require("express");
const { Firestore } = require("@google-cloud/firestore");

const { decryptData } = require("../utils/decryption");
const { getTradeProfitLossDetails } = require("../utils/utils");
const CustomError = require("../utils/error");
const { validateTrader } = require("../middleware/validation");

const router = express.Router();
const db = new Firestore();

router.get(
  "/order/:exchange/:symbol/:tradeId",
  validateTrader,
  async (req, res) => {
    try {
      const traderId = req.get("traderId");

      if (!traderId) {
        throw new CustomError("Trader name missing", 400, "orderRoutes");
      }

      // Fetch userDoc and exchangesData in parallel
      const [userDoc, exchangesData] = await Promise.all([
        db.collection("traders").doc(traderId).get(),
        db
          .collection("traders")
          .doc(traderId)
          .get()
          .then((doc) => doc.data().exchanges || {}),
      ]);

      if (!userDoc.exists) {
        throw new CustomError("Trader not found.", 404, "orderRoutes");
      }

      const tradeId = req.params.tradeId;
      const exchange = req.params.exchange;
      const symbol = req.params.symbol;

      if (exchange === "bybit") {
        throw new CustomError(
          "Bybit is not supported by this endpoint.",
          400,
          "orderRoutes"
        );
      }

      if (!exchangesData || !(exchange in exchangesData)) {
        throw new CustomError("No exchange found.", 404, "orderRoutes");
      }

      const keys = exchangesData[exchange];
      if (!("api_key" in keys && keys.api_key !== "x")) {
        throw new CustomError(
          "API key not found for the exchange.",
          404,
          "orderRoutes"
        );
      }

      const apiKey = keys.api_key;
      const apiSecret = await decryptData(keys.api_secret, traderId);
      let apiPassphrase = null;
      if ("api_passphrase" in keys) {
        apiPassphrase = await decryptData(keys.api_passphrase, traderId);
      }

      if (exchange === "kucoin" && !apiPassphrase) {
        throw new CustomError(
          "Kucoin requires a passphrase",
          400,
          "orderRoutes"
        );
      }

      const details = await getTradeProfitLossDetails(
        traderId,
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
        throw new CustomError(
          `Trade with ID ${tradeId} not found.`,
          404,
          "orderRoutes"
        );
      }
    } catch (e) {
      if (e instanceof CustomError) {
        next(e);
      } else {
        next(
          new CustomError(
            "An error occurred while fetching the trade details.",
            500,
            "orderRoutes"
          )
        );
      }
    }
  }
);

module.exports = router;
