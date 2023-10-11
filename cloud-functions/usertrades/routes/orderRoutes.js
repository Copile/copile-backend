const express = require("express");
const { Firestore } = require("@google-cloud/firestore");

const decryptData = require("../utils/decryption");
const { getTradeProfitLossDetails } = require("../utils/utils");
const CustomError = require("../utils/error");
const validateUser = require("../middleware/validation");

const router = express.Router();
const db = new Firestore();

router.get(
  "/order/:exchange/:symbol/:tradeId",
  validateUser,
  async (req, res, next) => {
    try {
      const userId = req.get("userId");

      if (!userId) {
        throw new CustomError({
          message: "UserId is missing.",
          status: 400,
          source: "orderRoutes",
        });
      }

      // Fetch userDoc and exchangesData in parallel
      const [userDoc, exchangesData] = await Promise.all([
        db.collection("users").doc(userId).get(),
        db
          .collection("users")
          .doc(userId)
          .get()
          .then((doc) => doc.data().exchanges || {}),
      ]);

      if (!userDoc.exists) {
        throw new CustomError({
          message: `User ${userId} not found`,
          status: 404,
          source: "orderRoutes",
        });
      }

      const tradeId = req.params.tradeId;
      const exchange = req.params.exchange;
      const symbol = req.params.symbol;

      if (exchange === "bybit") {
        throw new CustomError({
          message: `Bybit is not supported by this endpoint.`,
          status: 400,
          source: "orderRoutes",
        });
      }

      if (!exchangesData || !(exchange in exchangesData)) {
        throw new CustomError({
          message: `Exchange ${exchange} not found`,
          status: 404,
          source: "orderRoutes",
        });
      }

      const keys = exchangesData[exchange];
      if (!("api_key" in keys && keys.api_key !== "x")) {
        throw new CustomError({
          message: `API key not found for ${exchange}`,
          status: 404,
          source: "orderRoutes",
        });
      }

      const apiKey = keys.api_key;
      const apiSecret = await decryptData(keys.api_secret, userId);
      let apiPassphrase = null;
      if ("api_passphrase" in keys) {
        apiPassphrase = await decryptData(keys.api_passphrase, userId);
      }

      if (exchange === "kucoin" && !apiPassphrase) {
        throw new CustomError({
          message: `Kucoin requires a passphrase`,
          status: 400,
          source: "orderRoutes",
        });
      }

      const details = await getTradeProfitLossDetails(
        userId,
        tradeId,
        exchange,
        symbol,
        apiKey,
        apiSecret,
        apiPassphrase
      );

      if (details) {
        res.status(200).json(details);
      }/* else {
        res.status(404).json({
          message: "No details found for this trade",
        });
      }*/
    } catch (e) {
      if (e instanceof CustomError) {
        next(e);
      } else {
        next(
          new CustomError({
            message: `An error occurred while fetching the trade details: ${e.message}`,
            status: 500,
            source: "orderRoutes",
          })
        );
      }
    }
  }
);

module.exports = router;
