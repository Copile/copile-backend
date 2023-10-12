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
async function fetchLatestTradeDoc(traderId, symbol, exchange, side, price) {
  try {
    // Calculate the number of decimal places in the price
    const decimalPlaces = (price.toString().split(".")[1] || []).length;

    // Calculate a dynamic tolerance value based on the number of decimal places
    const tolerance = Math.pow(10, -decimalPlaces - 1);

    const lowerPrice = price - tolerance;
    const higherPrice = price + tolerance;

    // Fetch data based on other filters but not price
    const tradeQuerySnapshot = await db
      .collection("traders")
      .doc(traderId)
      .collection("trades")
      .where("symbol", "==", symbol)
      .where("exchange", "==", exchange)
      .where("side", "==", side)
      .orderBy("created_at", "desc")
      .limit(10) // Limit can be adjusted based on your specific needs
      .get();

    if (tradeQuerySnapshot.empty) {
      console.log(
        `No trade document found for trader ${traderId}, symbol ${symbol}, exchange ${exchange}, and side ${side}`
      );
      return null;
    }

    // Find the first document that matches the price range
    const matchingDoc = tradeQuerySnapshot.docs.find((doc) => {
      const docPrice = parseFloat(doc.data().price);
      return docPrice >= lowerPrice && docPrice <= higherPrice;
    });

    if (!matchingDoc) {
      console.log(
        `No trade document found within the price range for trader ${traderId}, symbol ${symbol}, exchange ${exchange}, and side ${side}`
      );
      return null;
    }

    return matchingDoc;
  } catch (error) {
    throw new CustomError({
      message: `Error fetching trade document: ${error.message}`,
      status: 500,
      source: "fetchLatestTradeDoc",
    });
  }
}

async function mapPositionToTrade(position, traderId, exchange) {
  try {
    const tradeDoc = await fetchLatestTradeDoc(
      traderId,
      position.symbol,
      exchange,
      position.side,
      position.entry_price
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
 * @param {string} traderId Trader ID.
 * @param {string} symbol Symbol of the trade.
 * @param {string} exchange Exchange name.
 * @param {string} side Trade side.
 * @returns {Promise} Returns a promise that resolves with the latest trade document or null.
 */
async function getTradeDoc(traderId, symbol, exchange, side, price) {
  const formattedSide =
    side.charAt(0).toUpperCase() + side.slice(1).toLowerCase();
  const tradeDoc = await fetchLatestTradeDoc(
    traderId,
    symbol,
    exchange,
    formattedSide,
    price
  );
  return tradeDoc;
}

module.exports = { mapPositionToTrade, getTradeDoc };
