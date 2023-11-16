// Import necessary modules and functions
const KuCoinFutures = require("kucoin-futures-node-sdk").default;
const getAction = require("./utils/getAction.js");
const tradeExecution = require("./tradeExecution.js");

// Hardcoded API credentials for demonstration (Use environment variables in production)
const API_KEY = "637967ef0adca800011fd0a6";
const API_SECRET = "11b7ceaf-7a2a-4134-8503-247642a01fe3";
const API_PASSPHRASE = "mira12345678";

// Initialize KuCoin Futures SDK with API credentials
const futuresSDK = new KuCoinFutures({
  key: API_KEY,
  secret: API_SECRET,
  passphrase: API_PASSPHRASE,
});

// Function to transform order data
const transformOrder = (action, orderData) => {
  return {
    symbol: orderData.symbol,
    type: orderData.type,
    quantity: orderData.size,
    orderId: String(orderData.id),
    side: orderData.side === "buy" ? "Buy" : "Sell",
    leverage: orderData.leverage,
    detection: action,
    entry: orderData.price,
  };
};

// Function to process trade orders
const handleTradeOrders = async (data) => {
  try {
    console.log("Received trade order data:", data);

    let orders = [];
    const action = getAction(data);

    if (action.includes("cancelled")) {
      orders.push(transformOrder(action, data.data));
    } else {
      const orderId = data.data.orderId;
      const orderDetails = await futuresSDK.futuresOrderDetail(orderId);
      orders.push(transformOrder(action, orderDetails.data));
    }

    console.log("Orders:", orders);
    // await tradeExecution(orders);
  } catch (error) {
    console.error("Error in handleTradeOrders:", error);
  }
};

// Function to process stop orders
const handleStopOrders = async (data) => {
  try {
    console.log("Received stop order data:", data);

    let orders = [];
    const action = getAction(data);

    if (action.includes("cancelled")) {
      orders.push(transformOrder(action, data.data));
    } else {
      const orderId = data.data.orderId;
      const orderDetails = await futuresSDK.futuresOrderDetail(orderId);
      orders.push(transformOrder(action, orderDetails.data));
    }

    console.log("Orders:", orders);
    // await tradeExecution(orders);
  } catch (error) {
    console.error("Error in handleStopOrders:", error);
  }
};

// Subscribing to trade and stop order topics
const subscribeToOrders = () => {
  futuresSDK.websocket
    .tradeOrders("", handleTradeOrders)
    .catch((err) => console.error("Failed to subscribe to trade orders:", err));

  futuresSDK.websocket
    .advancedOrders(handleStopOrders)
    .catch((err) => console.error("Failed to subscribe to stop orders:", err));
};

// Invoke the subscription function
subscribeToOrders();
