const express = require("express");
const { Firestore } = require("@google-cloud/firestore");
const decryptData = require("../utils/decryption");
const createSession = require("../exchanges/sessionFactory");
const validateUser  = require("../middleware/validation");
const CustomError = require("../utils/error");

const router = express.Router();
const db = new Firestore();

router.get("/balance/:exchange", validateUser, async (req, res, next) => {
  const userId = req.get("userId");
  const exchange = req.params.exchange;

  if (exchange === "bybit") {
    throw new CustomError({
      message: "Bybit is not supported by this endpoint.",
      status: 400,
      source: "balanceRoutes",
    });
  }

  try {
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new CustomError({
        message: `User ${userId} not found`,
        status: 404,
        source: "balanceRoutes",
      });
    }

    const exchangesData = userDoc.data().exchanges || {};

    if (!exchangesData || !(exchange in exchangesData)) {
      throw new CustomError({
        message: `Exchange ${exchange} not found`,
        status: 404,
        source: "balanceRoutes",
      });
    }
    const keys = exchangesData[exchange];
    if (!("api_key" in keys && keys.api_key !== "x")) {
      throw new CustomError({
        message: `API key not found for ${exchange}`,
        status: 404,
        source: "balanceRoutes",
      });
    }

    const apiKey = keys.api_key;
    const apiSecret = (await decryptData(keys.api_secret, userId)) || null;

    let apiPassphrase = null;
    if ("api_passphrase" in keys) {
      apiPassphrase = await decryptData(keys.api_passphrase, userId);
    }

    if (exchange === "kucoin" && apiPassphrase === null) {
      throw new CustomError({
        message: "Kucoin requires a passphrase",
        status: 400,
        source: "balanceRoutes",
      });
    }

    const session = createSession(exchange, apiKey, apiSecret, apiPassphrase);
    const balance = await session.getBalance();

    return res.status(200).json({ success: true, balance: balance });
  } catch (e) {
    if (e instanceof CustomError) {
      next(e);
    } else {
      next(
        new CustomError({
          message: "An error occurred while fetching the balance details.",
          status: 500,
          source: "balanceRoutes",
        })
      );
    }
  }
});

module.exports = router;
