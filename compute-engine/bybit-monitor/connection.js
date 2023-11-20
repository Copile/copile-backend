require("dotenv").config();
const { WebsocketClient } = require("bybit-api");
const tradeExecution = require("./utils/tradeExecution.js");
const getAction = require("./utils/getAction.js");
const { getUserKeys } = require('./firestore/firestore.js');

let ws;

async function getKeys(accountId) {
  let keys = await getUserKeys(accountId, process.env.TRADER_EXCHANGE);

  if (keys !== false) {
    return keys;
  } else {
    return null;
  }
}

async function initWebSocket(keys) {
  if (!keys) return;

  const wsConfig = {
    key: keys.read_only_api_key,
    secret: keys.read_only_api_secret,
    testnet: true,
    market: "v5",
    pongTimeout: 1000,
    pingInterval: 10000,
    reconnectTimeout: 500,
  };

  ws = new WebsocketClient(wsConfig);

  ws.subscribeV5("order", "linear").catch((err) => {
    console.error("Failed to subscribe:", err);
  });

  ws.on("update", async (orders) => {
    try {
      orders = orders.data;
      console.log("raw orders", orders);
      // Sort the orders based on the 'getAction'
      orders.sort((a, b) => {
        const actionA = getAction(a);
        const actionB = getAction(b);

        if (actionA === "new_order" || actionA === "cancelled_order") {
          return -1;
        }
        if (actionB === "new_order" || actionB === "cancelled_order") {
          return 1;
        }

        return 0;
      });

      let updated_orders = new Array();

      let orders_length = orders.length;
      for (let i = 0; i < orders_length; i++) {
        let order = {
          symbol: orders[i].symbol,
          type: orders[i].orderType,
          quantity: orders[i].qty,
          orderId: orders[i].orderId,
          side: orders[i].side,
          leverage: "20",
          detection: getAction(orders[i]),
        };
        let trigger_price_detection = [
          "new_take_profit",
          "new_stop_loss",
          "cancelled_take_profit",
          "cancelled_stop_loss",
        ];
        order.entry = trigger_price_detection.includes(order.detection)
          ? orders[i].triggerPrice
          : orders[i].price;
        updated_orders.push(order);
      }
      await tradeExecution(updated_orders);

      console.log("updated orders", updated_orders);
    } catch (error) {
      console.error("Error processing WebSocket message:", error);
    }
  });
}

async function startProcess() {
  const accountId = process.env.ACCOUNT_ID;
  let keys = await getKeys(accountId);

  await initWebSocket(keys);

  setInterval(async () => {
    keys = await getKeys(accountId);
    if (!keys) {
      // If keys are invalid, close the existing WebSocket connection.
      if (ws) ws.close();
    } else {
      // Reinitialize WebSocket with new keys.
      await initWebSocket(keys);
    }
  }, 600000);
}

startProcess();
