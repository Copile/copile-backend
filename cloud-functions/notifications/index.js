// Importing necessary modules
const express = require("express");
const applyMiddleware = require("./middleware");
// Initializing express app
const app = express();
// Importing discord.js for Discord API interactions
const { Client, GatewayIntentBits } = require("discord.js");
// Importing utility functions
const {
  sendTelegramMessage,
  fetchUserData,
  fetchFirestoreTradeData,
  constructTradeEmbed,
  constructActionEmbed,
} = require("./utils");

// Creating a new Discord client
const client = new Client({
  intents: [GatewayIntentBits.DirectMessages],
});

// Applying middleware to the express app
applyMiddleware(app);

// Getting Discord bot token from environment variables
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

// Event listener for when the Discord client is ready
client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

// Logging in the Discord client with the bot token
client.login(DISCORD_BOT_TOKEN);

// POST endpoint for trade notifications
app.post("/trade", async (req, res) => {
  console.log("/trade hit");

  try {
    // Getting trade data from the request body
    const tradeBody = req.body;
    const tradeData = tradeBody.data;

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

    // If theres no user ID, return an error
    if (!tradeBody.user_id) {
      return res
        .status(400)
        .json({ success: false, error: "No user ID provided." });
    }

    // Fetching user data from firestore using the user ID
    const userData = await fetchUserData(tradeBody.user_id);
    // Extracting Discord and Telegram IDs from the user data
    const discordId = userData.discord.id;
    const telegramId = userData.telegram.id;

    // Array to keep track of where notifications are sent
    let notificationSent = [];

    // If Discord ID is present, send a Discord notification
    if (discordId !== "x") {
      // Constructing the Discord embed message
      const embed = constructTradeEmbed(tradeBody);

      // Fetching the Discord user and sending them the message
      const user = await client.users.fetch(discordId);
      user.send({ embeds: [embed] }).catch((error) => {
        console.log(`Could not send discord DM to ${user.tag}.`, error);
        return res.status(500).json({ success: false, error: error });
      });

      // Adding Discord to the list of sent notifications
      notificationSent.push("Discord");
    }

    // If Telegram ID is present, send a Telegram notification
    if (telegramId !== "x") {
      // Constructing the Telegram message
      const message = `NEW TRADE OPENED: #${tradeData.order.symbol} | #${tradeData.order.side} | ${tradeData.order.leverage}`;

      // Sending the Telegram message
      const { success } = await sendTelegramMessage(telegramId, message);

      // If the message was sent successfully, add Telegram to the list of sent notifications
      if (success) {
        notificationSent.push("Telegram");
      }
    }

    // If no notifications were sent, return an error
    if (notificationSent.length === 0) {
      console.log("No Discord or Telegram ID found for user.");
      return res.status(400).json({
        success: false,
        message: "No Discord or Telegram ID found for user.",
      });
    } else {
      // If notifications were sent, return a success message
      console.log(`Notifications sent to: ${notificationSent.join(", ")}`);
      return res.status(200).json({
        success: true,
        message: `Notifications sent to: ${notificationSent.join(", ")}`,
      });
    }
  } catch (err) {
    // If an error occurs, log it and return an error message
    console.log(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST endpoint for action notifications
app.post("/action", async (req, res) => {
  try {
    // Getting action data from the request body
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

    // If theres no user ID, return an error
    if (!actionData.user_id) {
      return res
        .status(400)
        .json({ success: false, error: "No user ID provided." });
    }

    // Fetching user data from firestore using the user ID
    const userData = await fetchUserData(actionData.user_id);
    // Extracting Discord and Telegram IDs from the user data
    const discordId = userData.discord.id;
    const telegramId = userData.telegram.id;

    // Fetching trade data from Firestore using the user ID and trade ID
    const fireStoreTradeData = await fetchFirestoreTradeData(
      actionData.user_id,
      actionData.trade_id
    );

    // example trade data
    // const fireStoreTradeData = {
    //   user_id: <user_id_here>,
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

    // Updating the action text based on the action type
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

    // Array to keep track of where notifications are sent
    let notificationSent = [];

    // If Discord ID is present, send a Discord notification
    if (discordId !== "x") {
      // Constructing the Discord embed message
      const embed = constructActionEmbed(fireStoreTradeData, actionText);

      // Fetching the Discord user and sending them the message
      const user = await client.users.fetch(discordId);
      user.send({ embeds: [embed] }).catch((error) => {
        console.log(`Could not send discord DM to ${user.tag}.`, error);
        return res.status(500).json({ success: false, error: error });
      });

      // Adding Discord to the list of sent notifications
      notificationSent.push("Discord");
    }

    // If Telegram ID is present, send a Telegram notification
    if (telegramId !== "x") {
      // Constructing the Telegram message
      const message = `${fireStoreTradeData.symbol} | ${fireStoreTradeData.side} UPDATED: ${actionText}`;

      // Sending the Telegram message
      const { success } = await sendTelegramMessage(telegramId, message);

      // If the message was sent successfully, add Telegram to the list of sent notifications
      if (success) {
        notificationSent.push("Telegram");
      }
    }

    // If no notifications were sent, return an error
    if (notificationSent.length === 0) {
      console.log("No Discord or Telegram ID found for user.");
      return res.status(400).json({
        success: false,
        message: "No Discord or Telegram ID found for user.",
      });
    } else {
      // If notifications were sent, return a success message
      console.log(`Notifications sent to: ${notificationSent.join(", ")}`);
      return res.status(200).json({
        success: true,
        message: `Notifications sent to: ${notificationSent.join(", ")}`,
      });
    }
  } catch (error) {
    // If an error occurs, log it and return an error message
    console.log(error);
    return res.status(500).json({ success: false, error: error.message });
  }
});
// Exporting the express app
exports.notifications = app;
