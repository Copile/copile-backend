const { getOrders , getOrder } = require("./request");
const { getTradeDoc } = require("../../utils/firestore");

async function getBingXOrderStatuses(apiKey, apiSecret) {
    try {
      const rawOrders = await getOrders(apiKey, apiSecret, true);
      return rawOrders.map((order) => ({
        order_id: order.orderId, // Assuming the orderId field exists based on your previous snippets
        status: order.status === "NEW" ? "Active" : order.status,
      }));
    } catch (e) {
      console.log(`Error fetching BingX active orders: ${e}`);
      return [];
    }
  }

  async function getBingXOrderById(symbol, orderID, apiKey, apiSecret) {
    try {
      const order = await getOrder(apiKey, apiSecret, symbol, orderID);
      return order;
    } catch (e) {
      console.log(
        `An error occurred while retrieving trades from BingX. Error message: ${e}`
      );
      return null;
    }
  }

  async function getBingXOrders(apiKey, apiSecret, trader_id) {
    try {
      const orders = await getOrders(apiKey, apiSecret);
  
      const bingxMatchingParams = await Promise.all(
        orders.map(async (order) => {
          const tradeDoc = await getTradeDoc(
            trader_id,
            order.symbol,
            "bingx",
            order.side
          );
          const tradeData = tradeDoc.data();
          return {
            trade_id: tradeDoc.id,
            order_id: order.orderId,
            symbol: order.symbol,
            side:
              order.side.charAt(0).toUpperCase() +
              order.side.slice(1).toLowerCase(),
            leverage: tradeData.leverage,
            margin: tradeData.margin,
            type: "LIMIT",
            entry_price: order.price,
            quantity: order.origQty,
            status: "Active",
            created_at: tradeData.created_at,
          };
        })
      );
  
      return bingxMatchingParams;
    } catch (e) {
      console.log(
        `An error occurred while retrieving active orders from BingX. Error message: ${e}`
      );
      return [];
    }
  }

module.exports = { getBingXOrderStatuses, getBingXOrders, getBingXOrderById };