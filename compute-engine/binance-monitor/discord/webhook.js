const { WebhookClient, EmbedBuilder } = require("discord.js");
var order_actions = require("./actions.json");

const HOOK_URL =
  "https://discord.com/api/webhooks/1161734587408449667/IcYiBfCAEMXfpQnc3TU188zSSTXnnjxIxGFgYnsfULDq7vLE70Pji6U5USyzRiI0kbfX";

const webhookClient = new WebhookClient({ url: HOOK_URL });

async function discordMessage(order) {
  const embed = new EmbedBuilder()
    .setTitle(order_actions[order.detection]["text"])
    .setColor(order_actions[order.detection]["color"])
    .addFields(
      { name: "Symbol", value: order.symbol, inline: true },
      { name: "Entry", value: order.entry, inline: true },
      { name: "Type", value: order.type, inline: false },
      { name: "Quantity", value: order.quantity, inline: true },
      { name: "Order ID", value: order.orderId }
    );

  // FIXME: needs adjusting for binance
  webhookClient.send({
    username: "Bybit Bot",
    avatarURL:
      "https://www.bybit.com/common-static/cht-static/user-svc/img/kol_sign_up/default-avatar.png",
    embeds: [embed],
  });
}

module.exports = {
  discordMessage,
};
