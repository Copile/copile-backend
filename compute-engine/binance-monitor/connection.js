require("dotenv").config();
const { WebsocketClient } = require("binance");
const tradeExecution = require("./utils/tradeExecution.js");
const getAction = require("./utils/getAction.js");

const API_KEY = process.env.API_KEY;
const API_SECRET = process.env.API_SECRET;
const tpSlOrders = ["TAKE_PROFIT_MARKET", "TAKE_PROFIT", "STOP_MARKET", "STOP_LIMIT"]

const ws = new WebsocketClient({
  api_key: API_KEY,
  api_secret: API_SECRET,
  beautify: true,
  pongTimeout: 1000,
  pingInterval: 10000,
  reconnectTimeout: 500,
});

ws.on("message", async (data) => {
  try {
    console.log(data);
    if (!isValidOrderUpdate(data)) {
      return;
    }

    console.log("============================= NEW ORDER =============================");
    console.log("--- RAW DATA ---");
    console.log(data);
    
    // Transform the order update into the desired format
    const order = {
      symbol: data.o.s,
      type: data.o.o,
      quantity: data.o.q,
      orderId: String(data.o.i),
      side: data.o.S,
      leverage: "20",
      detection: getAction(data.o),
      entry: data.o.p === '0' ? (data.o.ap !== '0' ? data.o.ap : data.o.sp) : data.o.p
    };

    if (order.entry == "0" && order.detection == "new_order") {
      return;
    } else if (data.o.X == "FILLED" && tpSlOrders.includes(data.o.o)) {
      return;
    }

    console.log("--- TRANSFORMED DATA ---");
    let orders = [];
    orders.push(order);
    console.log(order);
    await tradeExecution(orders);
  } catch (error) {
    console.error("Error processing WebSocket message:", error);
  }
});

ws.subscribeUsdFuturesUserDataStream();

function isValidOrderUpdate(data) {
  return data.e === "ORDER_TRADE_UPDATE" && isOrderFilledOrNewMarket(data.o);
}

function isOrderFilledOrNewMarket(order) {
  const isFilled = order.X === "FILLED";
  const isNewMarket = order.X === "NEW" && order.o === "MARKET";
  const isPartiallyFilled = order.X === "PARTIALLY_FILLED";
  return isFilled || isNewMarket || isPartiallyFilled;
}