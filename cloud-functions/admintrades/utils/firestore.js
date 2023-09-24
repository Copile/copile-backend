const { Firestore } = require("@google-cloud/firestore");
const CustomError = require("./error");
const db = new Firestore();

/**
 * Utility function to fetch the latest trade document.
 *
 * @param {string} traderId Trader ID.
 * @param {string} symbol Symbol of the trade.
 * @param {string} exchange Exchange name.
 * @param {string} side Trade side (e.g., "Buy" or "Sell").
 * @returns {Promise} Returns a promise that resolves with the latest trade document or null.
 */
async function fetchLatestTradeDoc(traderId, symbol, exchange, side) {
  try {
    const tradeQuerySnapshot = await db
      .collection("traders")
      .doc(traderId)
      .collection("trades")
      .where("symbol", "==", symbol)
      .where("exchange", "==", exchange)
      .where("side", "==", side)
      .orderBy("created_at", "desc")
      .limit(1)
      .get();

    if (tradeQuerySnapshot.empty) {
      return res
        .status(200)
        .json({
          message: `No trade document found for trader ${traderId}, symbol ${symbol}, exchange ${exchange}, and side ${side}`,
          source: "fetchLatestTradeDoc",
        });
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

async function mapPositionToTrade(position, traderId, symbol, exchange, side) {
  try {
    const tradeDoc = await fetchLatestTradeDoc(
      traderId,
      symbol,
      exchange,
      side
    );

    if (tradeDoc === null) return;

    const tradeData = tradeDoc.data();

    let isIsolated = position.tradeMode === 1 ? "isolated" : "cross";

    return {
      trade_id: tradeDoc.id, // Use the fetched trade id
      symbol: position.symbol,
      side:
        position.side.charAt(0).toUpperCase() +
        position.side.slice(1).toLowerCase(),
      margin_mode: isIsolated,
      leverage: position.leverage,
      quantity: String(position.size),
      margin: position.margin,
      entry_price: position.entryPrice,
      unrealised_pnl: position.unrealised_pnl,
      unrealised_pnl_pct: position.unrealised_pnl_pct,
      realised_pnl: position.realised_pnl,
      created_at: tradeData.created_at, // Include the 'created_at' field from the trade document
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
 * @param {string} traderId Trader ID.
 * @param {string} symbol Symbol of the trade.
 * @param {string} exchange Exchange name.
 * @param {string} side Trade side.
 * @returns {Promise} Returns a promise that resolves with the latest trade document or null.
 */
async function getTradeDoc(traderId, symbol, exchange, side) {
  const formattedSide =
    side.charAt(0).toUpperCase() + side.slice(1).toLowerCase();
  return await fetchLatestTradeDoc(traderId, symbol, exchange, formattedSide);
}

module.exports = { mapPositionToTrade, getTradeDoc };
