const express = require("express");
const { Firestore } = require("@google-cloud/firestore");
const { decryptData } = require("../utils/decryption");
const sessionFactory = require("../exchanges/sessionFactory");
const { validateTrader } = require("../middleware/validation");
const CustomError = require("../utils/error");

const router = express.Router();
const db = new Firestore();

router.get("/balance/:exchange", validateTrader, async (req, res, next) => {
  const traderId = req.get("traderId");
  const exchange = req.params.exchange;

  if (exchange === "bybit") {
    throw new CustomError(
      "Bybit is not supported by this endpoint.",
      400,
      "balanceRoutes"
    );
  }

  try {
    const traderRef = db.collection("traders").doc(traderId);
    const traderDoc = await traderRef.get();

    if (!traderDoc.exists) {
      throw new CustomError("Trader not found", 404, "balanceRoutes");
    }

    const exchangesData = traderDoc.data().exchanges || {};

    if (!exchangesData || !(exchange in exchangesData)) {
      throw new CustomError("No exchange found", 404, "balanceRoutes");
    }

    const keys = exchangesData[exchange];
    if (!("api_key" in keys && keys.api_key !== "x")) {
      throw new CustomError(
        "API key not found for the exchange",
        404,
        "balanceRoutes"
      );
    }

    const apiKey = keys.api_key;
    const apiSecret = (await decryptData(keys.api_secret, traderId)) || null;

    let apiPassphrase = null;
    if ("api_passphrase" in keys) {
      apiPassphrase = await decryptData(keys.api_passphrase, traderId);
    }

    if (exchange === "kucoin" && apiPassphrase === null) {
      throw new CustomError(
        "Kucoin requires a passphrase",
        400,
        "balanceRoutes"
      );
    }

    const session = sessionFactory.createSession(
      exchange,
      apiKey,
      apiSecret,
      apiPassphrase
    );
    const balance = await session.getBalance();

    return res.status(200).json({ success: true, balance: balance });
  } catch (e) {
    if (e instanceof CustomError) {
      next(e);
    } else {
      next(
        new CustomError(
          "An error occurred while fetching the balance details.",
          500,
          "balanceRoutes"
        )
      );
    }
  }
});

module.exports = router;
