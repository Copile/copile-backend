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
    let orders = await client.getActiveOrders({
      category: "linear",
      orderFilter: "order",
      settleCoin: "USDT",
    });

    if (!orders.length) {
      return [];
    }

    // Filter the orders to only show reduceOnly false and orderStatus "New"
    const filteredOrders = orders.result.list.filter(
      (order) => order.reduceOnly === false && order.orderStatus === "New"
    );

    const bybitMatchingParams = await Promise.all(
      filteredOrders.map(async (order) => {
        const tradeDoc = await getTradeDoc(
          traderId,
          order.symbol,
          "bybit",
          order.side
        );
        const tradeData = tradeDoc.data();
        return {
          trade_id: tradeDoc.id,
          symbol: order.symbol,
          side: order.side,
          leverage: tradeData.leverage,
          margin: tradeData.margin,
          type: "LIMIT",
          entry_price: order.price,
          quantity: order.qty,
          orderStatus: "Active",
          created_at: tradeData.created_at,
        };
      })
    );

    return bybitMatchingParams;
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
async function getTestnetOrderStatuses(apiKey, apiSecret) {
  try {
    const client = new ContractClient({
      key: apiKey,
      secret: apiSecret,
      strict_param_validation: true,
    });

    let orders = await client.getActiveOrders({
      orderFilter: "StopOrder",
      settleCoin: "USDT",
    });

    return orders.map(({ orderStatus, ...rest }) => ({
      ...rest,
      status: orderStatus === "Untriggered" ? "Active" : orderStatus,
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

module.exports = { getTestnetOrders, getTestnetOrderStatuses };
