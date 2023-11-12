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

const handleTradeOrders = (data) => {
  // Process the data received from trade orders
  console.log("Received trade order data:", data);
  const orderId = data.data.orderId;

  // futuresSDK.futuresOrderDetail(orderId).then((res) => {
  //   console.log("Order details:", res);
  // });

  // Additional processing logic goes here
};

const handleStopOrders = (data) => {
  // Process the data received from stop orders
  console.log("Received stop order data:", data);

  // Additional processing logic goes here
};

futuresSDK.websocket.tradeOrders("", handleTradeOrders).catch((err) => {
  console.error("Failed to subscribe to trade orders:", err);
});

futuresSDK.websocket.advancedOrders(handleStopOrders).catch((err) => {
  console.error("Failed to subscribe to stop orders:", err);
});
