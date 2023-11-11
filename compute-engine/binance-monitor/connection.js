require("dotenv").config();
const { WebsocketClient } = require("binance");
// const tradeExecution = require("./utils/tradeExecution.js");
const getAction = require("./utils/getAction.js");

// Jans binance
const API_KEY = "9uEl3DDT5S0Ij5koFvkfQdSy5jJH2KQ2cjoUNZEHXdfNQ4qVak13CLuxSWCNCZ8z";
const API_SECRET = "6AevR0uy1RZeMNfrh12IPFC1IoTkfntvpGVwDHWD6wIdkT4H8ZYEtJQyCQqu5BRZ";

const ws = new WebsocketClient({
  api_key: API_KEY,
  api_secret: API_SECRET,
  beautify: true,
  pongTimeout: 1000,
  pingInterval: 10000,
  reconnectTimeout: 500,
});

const tpSlOrders = ["TAKE_PROFIT_MARKET", "TAKE_PROFIT", "STOP_MARKET", "STOP_LIMIT"]

ws.on("message", async (data) => {
  try {
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

    console.log("============================= NEW ORDER =============================");
    console.log("--- RAW DATA ---");
    console.log(data);
    
    if (data.e == "ORDER_TRADE_UPDATE") {
      // Transform the order update into the desired format
      const order = {
        symbol: data.o.s,
        type: data.o.o,
        quantity: data.o.q,
        orderId: data.o.i,
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

      console.log("--- TRANSFORMED DATA ---");
      console.log(order);
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
