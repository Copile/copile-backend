const { getOrders } = require("./request");
const { getTradeDoc } = require("../../utils/firestore");

async function getBinanceOrderStatuses(apiKey, apiSecret) {
  try {
    const rawOrders = await getOrders(apiKey, apiSecret, true);
    console.log(rawOrders);
    return rawOrders.map((order) => ({
      ...order,
      status: order.status === "NEW" ? "Active" : order.status,
    }));
  } catch (e) {
    console.log(`Error fetching Binance active orders: ${e}`);
    return [];
  }
}

async function getBinanceOrders(apiKey, apiSecret, trader) {
  try {
    const orders = await getOrders(apiKey, apiSecret);

    const binanceMatchingParams = await Promise.all(
      orders.map(async (order) => {
        const tradeDoc = await getTradeDoc(
          trader,
          order.symbol,
          "binance",
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
          type: order.type,
          entry_price: order.price,
          quantity: order.origQty,
          status: order.status,
          created_at: tradeData.created_at,
        };
      })
    );

    return binanceMatchingParams;
  } catch (e) {
    console.log(
      `An error occurred while retrieving active orders from Binance. Error message: ${e}`
    );
    return [];
  }
}

module.exports = { getBinanceOrderStatuses, getBinanceOrders };
