const { getOrders, getOrder } = require("./request");
const { getTradeDoc } = require("../../utils/firestore");
const CustomError = require("../../utils/error");

/**
 * Retrieves the statuses of all BingX orders.
 * @param {string} apiKey The API key for BingX.
 * @param {string} apiSecret The API secret for BingX.
 * @returns {Promise<Array<Object>>} An array of order status objects.
 * @throws {CustomError} Throws a CustomError if the operation fails.
 */
async function getBingXOrderStatuses(apiKey, apiSecret) {
  try {
    const rawOrders = await getOrders(apiKey, apiSecret, true);
    return rawOrders.map((order) => ({
      order_id: order.orderId,
      status: order.status === "NEW" ? "Active" : order.status,
    }));
  } catch (e) {
    if (e instanceof CustomError) {
      throw e;
    }
    throw new CustomError({
      message: `Error fetching BingX active orders: ${e.message}`,
      source: 'getBingXOrderStatuses',
      status: 500,
    });
  }
}

/**
 * Retrieves a BingX order by its symbol and order ID.
 * @param {string} symbol The trading symbol.
 * @param {string} orderId The order ID.
 * @param {string} apiKey The API key for BingX.
 * @param {string} apiSecret The API secret for BingX.
 * @returns {Promise<Object|null>} The order object or null if not found.
 * @throws {CustomError} Throws a CustomError if the operation fails.
 */
async function getBingXOrderById(symbol, orderId, apiKey, apiSecret) {
  try {
    const order = await getOrder(apiKey, apiSecret, symbol, orderId);
    return order;
  } catch (e) {
    if (e instanceof CustomError) {
      throw e;
    }
    throw new CustomError({
      message: `An error occurred while retrieving trades from BingX: ${e.message}`,
      source: 'getBingXOrderById',
      status: 500,
    });
  }
}

/**
 * Retrieves BingX orders and their associated trade details.
 * @param {string} apiKey The API key for BingX.
 * @param {string} apiSecret The API secret for BingX.
 * @param {string} traderId The ID of the trader.
 * @returns {Promise<Array<Object>>} An array of order matching parameters.
 * @throws {CustomError} Throws a CustomError if the operation fails.
 */
async function getBingXOrders(apiKey, apiSecret, traderId) {
  try {
    const orders = await getOrders(apiKey, apiSecret);
    if(!orders.length) return [];

    const bingxMatchingParams = await Promise.all(
      orders.map(async (order) => {
        const tradeDoc = await getTradeDoc(
          traderId,
          order.symbol,
          "bingx",
          order.side
        );
        const tradeData = tradeDoc.data();
        if(tradeData === null) return {
          order_id: order.orderId,
          symbol: order.symbol,
          side: order.side.charAt(0).toUpperCase() + order.side.slice(1).toLowerCase(),
          type: "LIMIT",
          entry_price: order.price,
          quantity: order.origQty,
          status: order.status === "NEW" ? "Active" : order.status,
          isCopileTrade: false,
        };
        return {
          trade_id: tradeDoc.id,
          order_id: order.orderId,
          symbol: order.symbol,
          side: order.side.charAt(0).toUpperCase() + order.side.slice(1).toLowerCase(),
          leverage: tradeData.leverage,
          margin: tradeData.margin,
          type: "LIMIT",
          entry_price: order.price,
          quantity: order.origQty,
          status: "Active",
          created_at: tradeData.created_at,
          isCopileTrade: true,
        };
      })
    );

    return bingxMatchingParams;
  } catch (e) {
    if (e instanceof CustomError) {
      throw e;
    }
    throw new CustomError({
      message: `An error occurred while retrieving active orders from BingX: ${e.message}`,
      source: 'getBingXOrders',
      status: 500,
    });
  }
}

module.exports = { getBingXOrderStatuses, getBingXOrders, getBingXOrderById };
