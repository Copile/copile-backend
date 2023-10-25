require('dotenv').config();
const { WebsocketClient } = require('bybit-api');
const tradeExecution = require('./utils/tradeExecution.js');
const getAction  = require('./utils/getAction.js');

const API_KEY = process.env.API_KEY;
const API_SECRET = process.env.API_SECRET;

const wsConfig = {
  key: API_KEY,
  secret: API_SECRET,
  testnet: true,
  market: "v5"
};

const ws = new WebsocketClient(wsConfig);

ws.subscribeV5('order', 'linear').catch(err => {
  console.error('Failed to subscribe:', err);
});

ws.on('update', async (orders) => {
  try {
    orders = orders.data;
    // Sort the orders based on the 'getAction'  
    orders.sort((a, b) => {
      const actionA = getAction(a);
      const actionB = getAction(b);
      
      if (actionA === 'new_order' || actionA === 'cancelled_order') {
        return -1;
      }
      if (actionB === 'new_order' || actionB === 'cancelled_order') {
        return 1;
      }

      return 0;
    });

    let updated_orders = new Array()

    let orders_length = orders.length;
    for (let i = 0; i < orders_length; i++) {
      let order = {
        "symbol": orders[i].symbol,
        "type": orders[i].orderType,
        "quantity": orders[i].qty,
        "orderId": orders[i].orderId,
        "side": orders[i].side,
        "leverage": "20",
        "detection": getAction(orders[i])
      };
      let trigger_price_detection = ["new_take_profit", "new_stop_loss", "cancelled_take_profit", "cancelled_stop_loss"];
      order.entry = trigger_price_detection.includes(order.detection) ? orders[i].triggerPrice : orders[i].price;
      updated_orders.push(order);
    }
    await tradeExecution(updated_orders);
  } catch (error) {
    console.error('Error processing WebSocket message:', error);
  }
});