require("dotenv").config();
const { WebsocketClient } = require("binance");
const tradeExecution = require("./utils/tradeExecution.js");
const getAction = require("./utils/getAction.js");

const API_KEY = process.env.API_KEY;
const API_SECRET = process.env.API_SECRET;

const ws = new WebsocketClient({
  api_key: API_KEY,
  api_secret: API_SECRET,
  beautify: true,
  pongTimeout: 1000,
  pingInterval: 10000,
  reconnectTimeout: 500,
});

const tpSlOrders = ["TAKE_PROFIT_MARKET", "TAKE_PROFIT", "STOP_MARKET", "STOP_LIMIT"]
const filledOrders = ["new_take_profit", "new_stop_loss", "partial_close"]

ws.on("message", async (data) => {
  try {
    console.log(data);
    // if (data.e !== "ORDER_TRADE_UPDATE") {
    //   return;
    // }

    // process 'NEW' limit and stop orders as well as 'FILLED' orders, but ignore 'NEW' market orders that
    // have not been filled yet otherwise we wont know the entry price
    // if (
    //   data.e !== "ORDER_TRADE_UPDATE" ||
    //   (data.o.X !== "FILLED" && !(data.o.X === "NEW" && data.o.o !== "MARKET"))
    // ) {
    //   return;
    // }

    // Filtering market orders that aren't filled yet
    if (data.o.X !== "FILLED") {
      if (data.o.X == "NEW" && data.o.o == "MARKET") {
        return;
      }
    }

    console.log("============================= NEW ORDER =============================");
    console.log("--- RAW DATA ---");
    console.log(data);
    
    if (data.e == "ORDER_TRADE_UPDATE") {
      // Transform the order update into the desired format
      const order = {
        symbol: data.o.s,
        type: data.o.o,
        quantity: data.o.q,
        orderId: String(data.o.i),
        side: data.o.S,
        leverage: "20",
        detection: getAction(data.o),
        entry:
        tpSlOrders.includes(data.o.o)
            ? data.o.sp
            : data.o.o === "LIMIT" || data.o.o === "TAKE_PROFIT"
            ? data.o.p
            : data.o.ap,
      };

      if (order.entry == "0" && order.detection == "new_order") {
        return;
      }

      console.log("--- TRANSFORMED DATA ---");
      let orders = [];
      orders.push(order);
      console.log(order);
      await tradeExecution(orders);
    } else {
      console.log(data.e);
      console.log("No action needed for this websocket data");
      return;
    }
  } catch (error) {
    console.error("Error processing WebSocket message:", error);
  }
});

ws.subscribeUsdFuturesUserDataStream();
