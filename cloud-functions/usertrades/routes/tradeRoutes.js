const express = require("express");
const { Firestore } = require("@google-cloud/firestore");
const decryptData = require("../utils/decryption");
const validateUser = require("../middleware/validation");
const createSession = require("../exchanges/sessionFactory");
const CustomError = require("../utils/error");

const router = express.Router();
const db = new Firestore();

router.get("/trades/:exchange", validateUser, async (req, res, next) => {
  try {
    const userId = req.get("userId");
    const exchange = req.params.exchange;
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;

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
        source: "tradeRoutes",
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
        source: "tradeRoutes",
      });
    }

    const apiKey = keys.api_key;
    const apiSecret = await decryptData(keys.api_secret, userId);
    let apiPassphrase = null;
    if ("api_passphrase" in keys) {
      apiPassphrase = await decryptData(keys.api_passphrase, userId);
    }

    // Use factory pattern to create sessions
    const session = createSession(exchange, apiKey, apiSecret, apiPassphrase);

    if (!session) {
      throw new CustomError({
        message: `Unknown exchange: ${exchange}`,
        status: 400,
        source: "tradeRoutes",
      });
    }

    // Fetch trades and orders
    const [trades, orders] = await Promise.all([
      session.getPositions(userId),
      session.getOrders(userId),
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
    if (e instanceof CustomError) {
      next(e);
    } else {
      next(
        new CustomError({
          message: "An error occurred while fetching the trade details.",
          status: 500,
          source: "tradeRoutes",
        })
      );
    }
  }
});

module.exports = router;
