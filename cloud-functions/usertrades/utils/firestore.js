const { Firestore } = require("@google-cloud/firestore");
const CustomError = require("./error");
const db = new Firestore();

/**
 * Utility function to fetch the latest trade document.
 *
 * @param {string} userId User ID.
 * @param {string} symbol Symbol of the trade.
 * @param {string} exchange Exchange name.
 * @param {string} side Trade side (e.g., "Buy" or "Sell").
 * @returns {Promise} Returns a promise that resolves with the latest trade document or null.
 */
async function fetchLatestTradeDoc(userId, symbol, exchange, side) {
  try {
    const tradeQuerySnapshot = await db
      .collection("users")
      .doc(userId)
      .collection("trades")
      .where("symbol", "==", symbol)
      .where("exchange", "==", exchange)
      .where("side", "==", side)
      .orderBy("created_at", "desc")
      .limit(1)
      .get();

    if (tradeQuerySnapshot.empty) {
      console.log(
        `No trade document found for trader ${userId}, symbol ${symbol}, exchange ${exchange}, and side ${side}`
      );
      return null;
    }

    return tradeQuerySnapshot.docs[0];
  } catch (error) {
    throw new CustomError({
      message: `Error fetching trade document: ${error.message}`,
      status: 500,
      source: "fetchLatestTradeDoc",
    });
  }
}

async function mapPositionToTrade(position, userId, exchange) {
  try {
    const tradeDoc = await fetchLatestTradeDoc(
      userId,
      position.symbol,
      exchange,
      position.side
    );
    if (!tradeDoc) return;

    const tradeData = tradeDoc.data();

    return {
      trade_id: tradeDoc.id,
      created_at: tradeData.created_at,
      ...position,
    };
  } catch (error) {
    throw new CustomError({
      message: `Error mapping position to trade: ${error.message}`,
      status: 500,
      source: "mapPositionToTrade",
    });
  }
}

/**
 * Fetches the latest trade document based on provided parameters.
 *
 * @param {string} userId User ID.
 * @param {string} symbol Symbol of the trade.
 * @param {string} exchange Exchange name.
 * @param {string} side Trade side.
 * @returns {Promise} Returns a promise that resolves with the latest trade document or null.
 */
async function getTradeDoc(userId, symbol, exchange, side) {
  const formattedSide =
    side.charAt(0).toUpperCase() + side.slice(1).toLowerCase();
  const tradeDoc = await fetchLatestTradeDoc(
    userId,
    symbol,
    exchange,
    formattedSide
  );
  return tradeDoc;
}

module.exports = { mapPositionToTrade, getTradeDoc };
