const express = require("express");
const applyMiddleware = require("./middleware");
const app = express();
const { Client, GatewayIntentBits } = require("discord.js");
const {
  sendTelegramMessage,
  fetchUserData,
  fetchFirestoreTradeData,
  constructTradeEmbed,
  constructActionEmbed,
} = require("./utils");

const client = new Client({
  intents: [GatewayIntentBits.DirectMessages],
});

applyMiddleware(app);

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.login(DISCORD_BOT_TOKEN);

app.post("/trade", async (req, res) => {
  try {
    const tradeData = req.body;

    // example trade data
    // const tradeData = {
    //   trade_id: "123-123-123",
    //   order_id: "321321321",
    //   symbol: "BTCUSDT",
    //   type: "LIMIT",
    //   side: "SHORT",
    //   quantity: "0.11",
    //   entry: "25000",
    //   leverage: "20",
    //   margin: "100",
    //   exchange: "bingx",
    //   take_profits: [
    //     {
    //       tp_value: "25000",
    //       tp_percentage: "0.5",
    //       tp_amount: "0.5",
    //     },
    //   ],
    //   stop_losses: [
    //     {
    //       sl_value: "24000",
    //       sl_percentage: "0.5",
    //       sl_amount: "0.5",
    //     },
    //   ],
    // };

    // Get the user's Discord ID from Firestore
    if (!tradeData.user_id) {
      return res
        .status(400)
        .json({ success: false, error: "No user ID provided." });
    }

    const userData = await fetchUserData(tradeData.user_id);
    const discordId = userData.discord.id;
    const telegramId = userData.telegram.id;

    let notificationSent = [];

    if (discordId !== "x") {
      const embed = constructTradeEmbed(tradeData);

      const user = await client.users.fetch(discordId);
      user.send({ embeds: [embed] }).catch((error) => {
        console.log(`Could not send discord DM to ${user.tag}.`, error);
        return res.status(500).json({ success: false, error: error });
      });

      notificationSent.push("Discord");
    }

    if (telegramId !== "x") {
      const message = `NEW TRADE OPENED: #${tradeData.symbol} | #${tradeData.side} | ${tradeData.leverage}`;

      const { success } = await sendTelegramMessage(telegramId, message);

      if (success) {
        notificationSent.push("Telegram");
      }
    }

    if (notificationSent.length === 0) {
      console.log("No Discord or Telegram ID found for user.");
      return res.status(400).json({
        success: false,
        message: "No Discord or Telegram ID found for user.",
      });
    } else {
      console.log(`Notifications sent to: ${notificationSent.join(", ")}`);
      return res.status(200).json({
        success: true,
        message: `Notifications sent to: ${notificationSent.join(", ")}`,
      });
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/action", async (req, res) => {
  try {
    const actionData = req.body;

    // example action data
    // const actionData = {
    //   data: {
    //     take_profits: [
    //       {
    //         tp_value: "25000",
    //         tp_percentage: "0.5",
    //         tp_amount: "0.5",
    //       },
    //       {
    //         tp_value: "26000",
    //         tp_percentage: "0.5",
    //         tp_amount: "0.5",
    //       },
    //     ],
    //   },
    //   trade_id: "<trade_id_here>",
    //   user_id: "<user_id_here>",
    // };

    // Get the user's Discord ID from Firestore
    if (!actionData.user_id) {
      return res
        .status(400)
        .json({ success: false, error: "No user ID provided." });
    }

    const userData = await fetchUserData(actionData.user_id);
    const discordId = userData.discord.id;
    const telegramId = userData.telegram.id;

    // Get the trade data from Firestore

    const fireStoreTradeData = await fetchFirestoreTradeData(
      actionData.user_id,
      actionData.trade_id
    );

    // example trade data
    // const fireStoreTradeData = {
    //   created_at: 1693595313,
    //   entry: "25584",
    //   exchange: "bingx",
    //   leverage: "50",
    //   margin: 62,
    //   orderID: 1697687907600437200,
    //   orderType: "LIMIT",
    //   quantity: 0.1212,
    //   side: "Buy",
    //   symbol: "BTC-USDT",
    //   tradeID: "ba7417fd-e407-45c0-abd9-722a4c73fcc3",
    //   stop_losses: {
    //     "b41e6432-5af0-4361-b588-9ea6fd2f9065": {
    //       executed: "1",
    //       orderID: "1697700687804108800",
    //       sl_amount: 0.1212,
    //       sl_number: "1",
    //       sl_percentage: 1,
    //       sl_value: "25584",
    //     },
    //   },
    //   take_profits: {
    //     "d266f61d-29af-4b31-9a43-1b304157fcee": {
    //       executed: "1",
    //       orderID: "1697691450323505152",
    //       tp_amount: 0.1212,
    //       tp_number: 1,
    //       tp_percentage: 1,
    //       tp_value: 26150,
    //     },
    //   },
    // };

    // Get the action type from the query string
    const actionType = req.query.type;
    let actionText = "";

    // Update the action text to be more human readable
    switch (actionType) {
      case "bulktp":
        actionText = "New Take Profit Orders Added";
        break;
      case "cancelOrder":
        actionText = "Order Cancelled";
        break;
      case "replaceSL":
        actionText = "Stop Loss Updated";
        break;
      case "partialClose":
        actionText = "Trade Partially Closed";
        break;
      case "emergancyClose":
        actionText = "Trade Closed";
        break;
      default:
        actionText = "Unknown Action";
    }

    let notificationSent = [];

    if (discordId !== "x") {
      // Create the embed
      const embed = constructActionEmbed(fireStoreTradeData, actionText);

      const user = await client.users.fetch(discordId);
      user.send({ embeds: [embed] }).catch((error) => {
        console.log(`Could not send discord DM to ${user.tag}.`, error);
        return res.status(500).json({ success: false, error: error });
      });

      notificationSent.push("Discord");
    }

    if (telegramId !== "x") {
      const message = `${fireStoreTradeData.symbol} | ${fireStoreTradeData.side} UPDATED: ${actionText}`;

      const { success } = await sendTelegramMessage(telegramId, message);

      if (success) {
        notificationSent.push("Telegram");
      }
    }

    if (notificationSent.length === 0) {
      console.log("No Discord or Telegram ID found for user.");
      return res.status(400).json({
        success: false,
        message: "No Discord or Telegram ID found for user.",
      });
    } else {
      console.log(`Notifications sent to: ${notificationSent.join(", ")}`);
      return res.status(200).json({
        success: true,
        message: `Notifications sent to: ${notificationSent.join(", ")}`,
      });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, error: error.message });
  }
});
exports.notifications = app;
