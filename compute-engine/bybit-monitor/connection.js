const { WebsocketClient } = require('bybit-api');
const { WebhookClient, EmbedBuilder } = require('discord.js');

const HOOK_URL = "https://discord.com/api/webhooks/1161734587408449667/IcYiBfCAEMXfpQnc3TU188zSSTXnnjxIxGFgYnsfULDq7vLE70Pji6U5USyzRiI0kbfX";

const webhookClient = new WebhookClient({ url: HOOK_URL });

const API_KEY = "ZuhzXiG2TmZOASqM2T";
const API_SECRET = "OQSn8YsDKfE3XShN3bgD68uWiOxblJdUGwRD";

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

ws.on('update', (orders) => {
    console.log(orders["data"]);
  
    orders = orders.data;
    let orders_length = orders.length;
  
    for (let i = 0; i < orders_length; i++) {
      let order = {
        "symbol": orders[i].symbol,
        "detection": orders[i].reduceOnly == true ? "stop_order" : "new_order",
        "price": orders[i].price,
        "type": orders[i].orderType,
        "qty": orders[i].qty,
        "orderId": orders[i].orderId
      };
      console.log(order);
  
      const embed = new EmbedBuilder()
        .setTitle('Order Update')
        .setColor(0x00FFFF)
        .addFields(
          { name: 'Symbol', value: order.symbol },
          { name: 'Detection', value: order.detection },
          { name: 'Price', value: order.price },
          { name: 'Type', value: order.type },
          { name: 'Quantity', value: order.qty },
          { name: 'Order ID', value: order.orderId }
        );
  
      webhookClient.send({
        username: 'Bybit Bot',
        avatarURL: 'https://www.bybit.com/common-static/cht-static/user-svc/img/kol_sign_up/default-avatar.png',
        embeds: [embed],
      });
    }
  });