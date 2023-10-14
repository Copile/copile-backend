const { WebsocketClient } = require('bybit-api');
const { WebhookClient, EmbedBuilder } = require('discord.js');

const HOOK_URL = "https://discord.com/api/webhooks/1161734587408449667/IcYiBfCAEMXfpQnc3TU188zSSTXnnjxIxGFgYnsfULDq7vLE70Pji6U5USyzRiI0kbfX";

const webhookClient = new WebhookClient({ url: HOOK_URL });

const API_KEY = "ZuhzXiG2TmZOASqM2T";
const API_SECRET = "OQSn8YsDKfE3XShN3bgD68uWiOxblJdUGwRD";

order_actions = {
  "new_order" : {
    "text": "New Order",
    "color": 0x7CFC00,
  },
  "new_take_profit" : {
    "text": "New Take-Profit",
    "color": 0x00F7FF
  },
  "new_stop_loss" : {
    "text": "New Stop-Loss",
    "color": 0x00F7FF
  },
  "partial_close" : {
    "text": "Partial Close",
    "color": 0xFFD100
  },
  "cancelled_order" : {
    "text": "Cancelled Order",
    "color": 0xff0000,
  },
  "cancelled_take_profit" : {
    "text": "Cancelled Take-Profit",
    "color": 0xFF6800
  },
  "cancelled_stop_loss" : {
    "text": "Cancelled Stop-Loss",
    "color": 0xFF6800
  },
}


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

function getAction(order) {
  const actionMap = {
    "UNKNOWN": {
      "false": {
        "default": "new_order",
      },
      "true": {
        "default": "partial_close",
        "TakeProfit": "new_take_profit",
        "StopLoss": "new_stop_loss",
      }
    },
    "default": {
      "false": {
        "default": "cancelled_order",
      },
      "true": {
        "default": "Unknown",
        "TakeProfit": "cancelled_take_profit",
        "StopLoss": "cancelled_stop_loss",
      }
    }
  };

  const cancelType = actionMap[order.cancelType] || actionMap['default'];
  const reduceOnly = cancelType[order.reduceOnly] || cancelType['true'];
  const stopOrderType = reduceOnly[order.stopOrderType] || reduceOnly['default'];

  return stopOrderType;
}

ws.on('update', (orders) => {
    try {
      orders = orders.data;
      console.log(orders);
      let orders_length = orders.length;
    
      for (let i = 0; i < orders_length; i++) {
        let order = {
          "symbol": orders[i].symbol,
          "type": orders[i].orderType,
          "qty": orders[i].qty,
          "orderId": orders[i].orderId,
          "detection": getAction(orders[i])
        };
      
        trigger_price_detection = ["new_take_profit", "new_stop_loss", "cancelled_take_profit", "cancelled_stop_loss"]

        order.price = order.detection in trigger_price_detection ? orders[i].triggerPrice : orders[i].price;
      
        console.log(order);
        const embed = new EmbedBuilder()
          .setTitle(order_actions[order.detection]["text"])
          .setColor(order_actions[order.detection]["color"])
          .addFields(
            { name: 'Symbol', value: order.symbol, inline: true},
            { name: 'Price', value: order.price, inline: true},
            { name: 'Type', value: order.type, inline: false},
            { name: 'Quantity', value: order.qty, inline: true},
            { name: 'Order ID', value: order.orderId },
          );
    
        webhookClient.send({
          username: 'Bybit Bot',
          avatarURL: 'https://www.bybit.com/common-static/cht-static/user-svc/img/kol_sign_up/default-avatar.png',
          embeds: [embed],
        });
      }
    } catch(error) {
      console.error('Error processing WebSocket message:', error);
    }
  });