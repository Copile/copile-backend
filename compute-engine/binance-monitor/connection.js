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
});

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

    // Transform the order update into the desired format
    const order = {
      symbol: data.o.s,
      type: data.o.o,
      quantity: data.o.q,
      orderId: data.o.i,
      side: data.o.S,
      leverage: "20",
      detection: getAction(data.o),
      // If STOP_MARKET use the stop price, if LIMIT use the price, if MARKET use the average price
      entry:
        data.o.o === "STOP_MARKET"
          ? data.o.sp
          : data.o.o === "LIMIT" || data.o.o === "TAKE_PROFIT"
          ? data.o.p
          : data.o.ap,
    };

    console.log("--- TRANSFORMED DATA ---");
    console.log(order);

    // Pass the orders to the tradeExecution function
    // await tradeExecution([order]);

    // ==================== OLD CODE FOR BYBIT ====================

    // orders = orders.data;
    // // Sort the orders based on the 'getAction'
    // orders.sort((a, b) => {
    //   const actionA = getAction(a);
    //   const actionB = getAction(b);
    //   if (actionA === "new_order" || actionA === "cancelled_order") {
    //     return -1;
    //   }
    //   if (actionB === "new_order" || actionB === "cancelled_order") {
    //     return 1;
    //   }
    //   return 0;
    // });
    // let updated_orders = new Array();
    // let orders_length = orders.length;
    // for (let i = 0; i < orders_length; i++) {
    //   let order = {
    //     symbol: orders[i].symbol,
    //     type: orders[i].orderType,
    //     quantity: orders[i].qty,
    //     orderId: orders[i].orderId,
    //     side: orders[i].side,
    //     leverage: "20",
    //     detection: getAction(orders[i]),
    //   };
    //   let trigger_price_detection = [
    //     "new_take_profit",
    //     "new_stop_loss",
    //     "cancelled_take_profit",
    //     "cancelled_stop_loss",
    //   ];
    //   order.entry = trigger_price_detection.includes(order.detection)
    //     ? orders[i].triggerPrice
    //     : orders[i].price;
    //   updated_orders.push(order);
    // }
    // await tradeExecution(updated_orders);
  } catch (error) {
    console.error("Error processing WebSocket message:", error);
  }
});

ws.subscribeUsdFuturesUserDataStream();
