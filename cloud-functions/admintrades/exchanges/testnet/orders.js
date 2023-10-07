const { RestClientV5 } = require("bybit-api");
const { getTradeDoc } = require("../../utils/firestore");
const CustomError = require("../../utils/error");

/**
 * Retrieves open orders for a given trader ID from Firestore in a testnet environment.
 *
 * @async
 * @param {string} traderId - The unique ID of the trader.
 * @returns {Promise<Array<Object>>} An array of active order data objects.
 * @throws {CustomError} Throws a custom error if database operation fails.
 */
async function getTestnetOrders(apiKey, apiSecret, traderId) {
  try {
    const client = new RestClientV5({
      key: apiKey,
      secret: apiSecret,
      // strict_param_validation: true,
      testnet: true,
    });

    const response = await client.getActiveOrders({
      category: "linear",
      settleCoin: "USDT",
    });

    if (!response || !response.result.list.length) {
      return [];
    }

    // Filter the orders to only show reduceOnly false and orderStatus "New"
    const filteredOrders = response.result.list.filter(
      (order) => !order.reduceOnly && order.orderStatus === "New"
    );

    return await Promise.all(
      filteredOrders.map(async (order) => {
        const tradeDoc = await getTradeDoc(
          traderId,
          order.symbol,
          "testnet",
          order.side
        );
        if (!tradeDoc) return;
        const tradeData = tradeDoc.data();

        return {
          trade_id: tradeDoc.id,
          order_id: order.orderId,
          symbol: order.symbol,
          side:
            order.side.charAt(0).toUpperCase() +
            order.side.slice(1).toLowerCase(),
          type: order.orderType,
          entry_price: order.price,
          quantity: order.qty,
          status: "Active",
          leverage: tradeData.leverage,
          margin: tradeData.margin,
          created_at: tradeData.created_at,
        };
      })
    );
  } catch (e) {
    throw new CustomError({
      message: `Failed to fetch testnet orders: ${e.message}`,
      status: 500,
      source: "getTestnetPositions",
    });
  }
}

/**
 * Fetches active orders from Binance.
 * @async
 * @param {string} apiKey - The API key for Binance.
 * @param {string} apiSecret - The API secret for Binance.
 * @returns {Promise<Array>} An array of active orders with their statuses.
 * @throws {CustomError} Throws a custom error if the operation fails.
 */
async function getTestnetOrderStatuses(apiKey, apiSecret, symbol) {
  try {
    const client = new RestClientV5({
      key: apiKey,
      secret: apiSecret,
      // strict_param_validation: true,
      testnet: true,
    });

    let response = await client.getActiveOrders({
      category: "linear",
      symbol: symbol,
    });

    if (!response) {
      return [];
    }
    const orders = response.result.list;
    console.log("Bybit raw orders: ", orders);
    return orders.map(({ orderStatus, ...rest }) => ({
      ...rest,
      status: orderStatus === "Untriggered" || "New" ? "Active" : orderStatus,
    }));
  } catch (error) {
    // If it's already a custom error, throw it as-is
    if (error instanceof CustomError) {
      throw error;
    }
    throw new CustomError({
      message: `Error fetching Testnet active orders: ${error.message}`,
      status: 400,
      source: "getTestnetOrderStatuses",
    });
  }
}

module.exports = { getTestnetOrders, getTestnetOrderStatuses };
