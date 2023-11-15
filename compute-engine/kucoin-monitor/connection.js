// require("dotenv").config();
const KuCoinFutures = require("kucoin-futures-node-sdk").default;
const getAction = require("./utils/getAction.js");

const API_KEY = "637967ef0adca800011fd0a6";
const API_SECRET = "11b7ceaf-7a2a-4134-8503-247642a01fe3";
const API_PASSPHRASE = "mira12345678";
// const API_KEY = process.env.API_KEY;
// const API_SECRET = process.env.API_SECRET;

const futuresSDK = new KuCoinFutures({
  key: API_KEY,
  secret: API_SECRET,
  passphrase: API_PASSPHRASE,
});

const handleTradeOrders = async (data) => {
  // Process the data received from trade orders
  console.log("Received trade order data:", data);

  const orderId = data.data.orderId;
  const orderData = data.data;

  if (orderData.type !== "canceled") {
    const orderDetails = await futuresSDK.futuresOrderDetail(orderId);
    orderData = orderDetails.data;
  }

  const order = {
    symbol: orderData.symbol,
    type: orderData.type,
    quantity: orderData.size,
    orderId: String(orderData.id),
    side: orderData.side === "buy" ? "Buy" : "Sell",
    leverage: orderData.leverage,
    detection: "kp",
    entry: orderData.price,
  };

  let orders = [];
  orders.push(order);
  console.log("Transformed order:", order);

  /*futuresSDK.futuresOpenOrders().then((res) => {
    console.log("Open orders:", res.data.items);
  });

  futuresSDK.futuresStopOrders().then((res) => {
    console.log("Stop orders:", res.data.items);
  });*/
  // Additional processing logic goes here
};

const handleStopOrders = (data) => {
  // Process the data received from stop orders
  console.log("Received stop order data:", data);
};

futuresSDK.websocket.tradeOrders("", handleTradeOrders).catch((err) => {
  console.error("Failed to subscribe to trade orders:", err);
});

futuresSDK.websocket.advancedOrders(handleStopOrders).catch((err) => {
  console.error("Failed to subscribe to stop orders:", err);
});
