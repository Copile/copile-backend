const kucoinAPI = require("kucoin-futures-node-api");
const { getTradeDoc } = require("../../utils/firestore");

async function getKucoinOrderStatuses(apiKey, apiSecret, apiPassphrase) {
  try {
    const config = {
      apiKey: apiKey,
      secretKey: apiSecret,
      passphrase: apiPassphrase,
      environment: "live",
    };
    const apiLive = new kucoinAPI();
    apiLive.init(config);
    const rawOrders = await apiLive.getOrders({
      status: "active",
    });
    return (rawOrders.data.items || []).map((order) => ({
      order_id: order.id,
      status: order.status === "done" ? "Filled" : "Active",
    }));
  } catch (e) {
    console.log(`Error fetching KuCoin active orders: ${e}`);
    return [];
  }
}

async function getKucoinOrderById(
  symbol,
  orderID,
  apiKey,
  apiSecret,
  apiPassphrase
) {
  try {
    const config = {
      apiKey: apiKey,
      secretKey: apiSecret,
      passphrase: apiPassphrase,
      environment: "live",
    };
    const apiLive = new kucoinAPI();
    apiLive.init(config);
    let order = await apiLive.getOrderById({ oid: orderID });
    return order.data;
  } catch (e) {
    console.error(
      `An error occurred while retrieving trades from KuCoin. Error message: ${e}`
    );
    return null;
  }
}

async function getKucoinOrders(apiKey, apiSecret, apiPassphrase, trader_id) {
  try {
    const config = {
      apiKey: apiKey,
      secretKey: apiSecret,
      passphrase: apiPassphrase,
      environment: "live",
    };
    const apiLive = new kucoinAPI();
    apiLive.init(config);
    let orders = await apiLive.getOrders({
      status: "active",
    });

    let filteredOrders = [];

    if (orders.data.items !== null) {
      // Filter the orders to only show type "limit", reduceOnly false, and status "open"
      filteredOrders = orders.data.items.filter(
        (order) =>
          order.type === "limit" &&
          order.reduceOnly === false &&
          order.status === "open"
      );
    }

    // Extract matching parameters for KuCoin
    const kucoinMatchingParams = await Promise.all(
      filteredOrders.map(async (order) => {
        const tradeDoc = await getTradeDoc(
          trader_id,
          order.symbol,
          "kucoin",
          order.side
        );
        const tradeData = tradeDoc.data();
        return {
          trade_id: tradeDoc.id,
          order_id: order.id,
          symbol: order.symbol,
          side:
            order.side.charAt(0).toUpperCase() +
            order.side.slice(1).toLowerCase(),
          leverage: tradeData.leverage,
          margin: tradeData.margin,
          type: "LIMIT",
          entry_price: order.price,
          quantity: order.size,
          status: "Active",
          created_at: tradeData.created_at,
        };
      })
    );

    return kucoinMatchingParams;
  } catch (e) {
    console.log(
      `An error occurred while retrieving active orders from KuCoin. Error message: ${e}`
    );
    return [];
  }
}

module.exports = {
  getKucoinOrderStatuses,
  getKucoinOrders,
  getKucoinOrderById,
};
