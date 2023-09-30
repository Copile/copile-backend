const kucoinAPI = require("kucoin-futures-node-api");
const { getTradeDoc } = require("../../utils/firestore");
const CustomError = require("../../utils/error");

/**
 * Initialize KuCoin API client.
 * @param {string} apiKey - API key.
 * @param {string} apiSecret - API secret.
 * @param {string} apiPassphrase - API passphrase.
 * @returns {Object} - Initialized API client.
 */
const initKucoinApi = (apiKey, apiSecret, apiPassphrase) => {
  const config = {
    apiKey,
    secretKey: apiSecret,
    passphrase: apiPassphrase,
    environment: "live",
  };
  const apiLive = new kucoinAPI();
  apiLive.init(config);
  return apiLive;
};

/**
 * Fetch KuCoin order statuses.
 * @param {string} apiKey - API key.
 * @param {string} apiSecret - API secret.
 * @param {string} apiPassphrase - API passphrase.
 * @returns {Array} - Array of order statuses.
 */
async function getKucoinOrderStatuses(apiKey, apiSecret, apiPassphrase) {
  try {
    const apiLive = initKucoinApi(apiKey, apiSecret, apiPassphrase);
    const rawOrders = await apiLive.getOrders({ status: "active" });
    return (rawOrders.data.items || []).map((order) => ({
      orderId: order.id,
      status: order.status === "done" ? "Filled" : "Active",
    }));
  } catch (e) {
    // If it's already a custom error, throw it as-is
    if (e instanceof CustomError) {
      throw e;
    }
    // Otherwise, wrap it in a CustomError and specify the source
    throw new CustomError({
      message: `Failed to fetch KuCoin active orders: ${e.message}`,
      status: 500,
      source: "getKucoinOrderStatuses",
    });
  }
}

/**
 * Fetch KuCoin order by ID.
 * @param {string} symbol - Trading pair symbol.
 * @param {string} orderID - Order ID.
 * @param {string} apiKey - API key.
 * @param {string} apiSecret - API secret.
 * @param {string} apiPassphrase - API passphrase.
 * @returns {Object} - Order details.
 */
async function getKucoinOrderById(
  symbol,
  orderID,
  apiKey,
  apiSecret,
  apiPassphrase
) {
  try {
    const apiLive = initKucoinApi(apiKey, apiSecret, apiPassphrase);
    const order = await apiLive.getOrderById({ oid: orderID });
    return order.data;
  } catch (e) {
    // If it's already a custom error, throw it as-is
    if (e instanceof CustomError) {
      throw e;
    }
    // Otherwise, wrap it in a CustomError and specify the source
    throw new CustomError({
      message: `Failed to fetch KuCoin order by ID: ${e.message}`,
      status: 500,
      source: "getKucoinOrderById",
    });
  }
}

/**
 * Fetch KuCoin orders.
 * @param {string} apiKey - API key.
 * @param {string} apiSecret - API secret.
 * @param {string} apiPassphrase - API passphrase.
 * @param {string} traderId - Trader ID.
 * @returns {Array} - Array of orders.
 */
async function getKucoinOrders(apiKey, apiSecret, apiPassphrase, traderId) {
  try {
    const apiLive = initKucoinApi(apiKey, apiSecret, apiPassphrase);
    const orders = await apiLive.getOrders({ status: "active" });

    if (!orders.data.items) return [];

    const filteredOrders = orders.data.items.filter(
      (order) =>
        order.type === "limit" &&
        order.reduceOnly === false &&
        order.status === "open"
    );

    const kucoinMatchingParams = await Promise.all(
      filteredOrders.map(async (order) => {
        const tradeDoc = await getTradeDoc(
          traderId,
          order.symbol,
          "kucoin",
          order.side
        );
        const tradeData = tradeDoc.data();
        if(tradeData === null) {
          return {
            orderId: order.id,
            symbol: order.symbol,
            side:
              order.side.charAt(0).toUpperCase() +
              order.side.slice(1).toLowerCase(),
            type: "LIMIT",
            entryPrice: order.price,
            quantity: order.size,
            status: order.status === "NEW" ? "Active" : order.status,
            isCopileTrade: false,
          };
        }
        return {
          tradeId: tradeDoc.id,
          orderId: order.id,
          symbol: order.symbol,
          side:
            order.side.charAt(0).toUpperCase() +
            order.side.slice(1).toLowerCase(),
          leverage: tradeData.leverage,
          margin: tradeData.margin,
          type: "LIMIT",
          entryPrice: order.price,
          quantity: order.size,
          status: "Active",
          createdAt: tradeData.created_at,
          isCopileTrade: true,
        };
      })
    );

    return kucoinMatchingParams;
  } catch (e) {
    // If it's already a custom error, throw it as-is
    if (e instanceof CustomError) {
      throw e;
    }
    // Otherwise, wrap it in a CustomError and specify the source
    throw new CustomError({
      message: `Failed to fetch KuCoin orders: ${e.message}`,
      status: 500,
      source: "getKucoinOrders",
    });
  }
}

module.exports = {
  getKucoinOrderStatuses,
  getKucoinOrderById,
  getKucoinOrders,
};
