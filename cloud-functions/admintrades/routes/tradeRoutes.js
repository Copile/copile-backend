const express = require("express");
const { Firestore } = require("@google-cloud/firestore");
const decryptData = require("../utils/decryption");
const validateTrader = require("../middleware/validation");
const createSession = require("../exchanges/sessionFactory");
const CustomError = require("../utils/error");

const router = express.Router();
const db = new Firestore();

router.get("/trades/:exchange", async (req, res, next) => {
  try {
    const traderId = req.get("traderId");
    const exchange = req.params.exchange;
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;

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
      throw new CustomError({
        message: `Trader ${traderId} not found`,
        status: 404,
        source: "traderRoutes",
      });
    }

    if (!exchangesData || !(exchange in exchangesData)) {
      throw new CustomError({
        message: `Exchange ${exchange} not found`,
        status: 404,
        source: "traderRoutes",
      });
    }

    const keys = exchangesData[exchange];
    if (!("api_key" in keys && keys.api_key !== "x")) {
      throw new CustomError({
        message: `API key not found for ${exchange}`,
        status: 401,
        source: "traderRoutes",
      });
    }

    const apiKey = keys.api_key;
    const apiSecret = await decryptData(keys.api_secret, traderId);
    let apiPassphrase = null;
    if ("api_passphrase" in keys) {
      apiPassphrase = await decryptData(keys.api_passphrase, traderId);
    }

    // Use factory pattern to create sessions
    const session = createSession(exchange, apiKey, apiSecret, apiPassphrase);

    if (!session) {
      throw new CustomError({
        message: `Unknown exchange: ${exchange}`,
        status: 400,
        source: "traderRoutes",
      });
    }

    // Fetch trades and orders
    const [trades, orders] = await Promise.all([
      session.getPositions(traderId),
      session.getOrders(traderId),
    ]);

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
    console.log(e);
    if (e instanceof CustomError) {
      next(e);
    } else {
      next(
        new CustomError({
          message: "An error occurred while fetching the trade details.",
          status: 500,
          source: "traderRoutes",
        })
      );
    }
  }
});

module.exports = router;
