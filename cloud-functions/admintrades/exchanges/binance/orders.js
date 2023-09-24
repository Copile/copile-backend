const { getOrders } = require("./request");
const { getTradeDoc } = require("../../utils/firestore");
const CustomError = require("../../utils/error");

/**
 * Fetches active orders from Binance.
 * @async
 * @param {string} apiKey - The API key for Binance.
 * @param {string} apiSecret - The API secret for Binance.
 * @returns {Promise<Array>} An array of active orders with their statuses.
 * @throws {CustomError} Throws a custom error if the operation fails.
 */
async function getBinanceOrderStatuses(apiKey, apiSecret) {
  try {
    const rawOrders = await getOrders(apiKey, apiSecret, true);
    return rawOrders.map(({ status, ...rest }) => ({
      ...rest,
      status: status === "NEW" ? "Active" : status,
    }));
  } catch (error) {
    // If it's already a custom error, throw it as-is
    if (error instanceof CustomError) {
      throw error;
    }
    throw new CustomError({
      message: `Error fetching Binance active orders: ${error.message}`,
      status: 400,
      source: "getBinanceOrderStatuses",
    });
  }
}

/**
 * Fetches and matches Binance orders with corresponding Firestore trade documents.
 * @async
 * @param {string} apiKey - The API key for Binance.
 * @param {string} apiSecret - The API secret for Binance.
 * @param {string} traderId - The trader ID.
 * @returns {Promise<Array>} An array of matched orders with trade data.
 * @throws {CustomError} Throws a custom error if the operation fails.
 */
async function getBinanceOrders(apiKey, apiSecret, traderId) {
  try {
    const orders = await getOrders(apiKey, apiSecret);

    return await Promise.all(
      orders.map(async ({ symbol, side, type, price, origQty, orderId, status }) => {
        const tradeDoc = await getTradeDoc(traderId, symbol, "binance", side);
        const tradeData = tradeDoc.data();
        return {
          trade_id: tradeDoc.id,
          order_id: orderId,
          symbol,
          side: `${side.charAt(0).toUpperCase()}${side.slice(1).toLowerCase()}`,
          leverage: tradeData.leverage,
          margin: tradeData.margin,
          type,
          entry_price: price,
          quantity: origQty,
          status,
          created_at: tradeData.created_at,
        };
      })
    );
  } catch (error) {
    // If it's already a custom error, throw it as-is
    if (error instanceof CustomError) {
      throw error;
    }
    throw new CustomError({
      message: `Error fetching Binance orders: ${error.message}`,
      status: 400,
      source: "getBinanceOrders",
    });
  }
}

module.exports = { getBinanceOrderStatuses, getBinanceOrders };
