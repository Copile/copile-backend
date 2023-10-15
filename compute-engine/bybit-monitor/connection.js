const { WebsocketClient } = require('bybit-api');
const { discordMessage } = require('./discord/webhook.js');
const { storeTrade, storeSL } = require('./firestore/firestore.js');
const getAction  = require('./utils/getAction.js');
const reformatOrder = require('./utils/reformatOrder.js');

const API_KEY = "ZuhzXiG2TmZOASqM2T";
const API_SECRET = "OQSn8YsDKfE3XShN3bgD68uWiOxblJdUGwRD";
const accountId = "duelendigerdreckigerbastard"

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

async function storingOrder(order) {
  switch(order.detection) {
    case 'new_order':
      await storeTrade(accountId, order);
      break;
    case 'new_stop_loss' || 'new_take_profit':
      await reformatOrder(accountId, order);
      break
  }
}

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

    console.log(orders);
    let orders_length = orders.length;
  
    for (let i = 0; i < orders_length; i++) {
      let order = {
        "symbol": orders[i].symbol,
        "type": orders[i].orderType,
        "quantity": orders[i].qty,
        "orderId": orders[i].orderId,
        "side": orders[i].side,
        "leverage": "25",
        "detection": getAction(orders[i])
      };
    
      const trigger_price_detection = ["new_take_profit", "new_stop_loss", "cancelled_take_profit", "cancelled_stop_loss"];
      order.entry = trigger_price_detection.includes(order.detection) ? orders[i].triggerPrice : orders[i].price;
      
      await storingOrder(order);
      await discordMessage(order);
    }
  } catch (error) {
    console.error('Error processing WebSocket message:', error);
  }
});
