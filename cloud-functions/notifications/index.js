const Firestore = require("@google-cloud/firestore");
const db = new Firestore();
const datetime = require("moment");
const axios = require("axios");
const express = require("express");
const applyMiddleware = require("./middleware");
const app = express();
const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.DirectMessages],
});

applyMiddleware(app);

const TELEGRAM_BOT_KEY = process.env.TELEGRAM_BOT_KEY;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

async function sendTelegramMessage(chat_id, message) {
  const send_message_url = `https://api.telegram.org/bot${TELEGRAM_BOT_KEY}/sendMessage?chat_id=${chat_id}&text=${message}`;
  try {
    await axios.post(send_message_url);
    return {
      success: true,
      message: "Telegram message sent successfully.",
    };
  } catch (error) {
    console.log("Failed to send Telegram message.", error);
    return {
      success: false,
      message: "Failed to send Telegram message.",
    };
  }
}

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
      res.status(400).json({ success: false, error: "No user ID provided." });
      return;
    }

    const userRef = db.collection("users").doc(tradeData.user_id);
    const userDoc = await userRef.get();
    const discordId = userDoc.data().discord.id;
    const telegramId = userDoc.data().telegram.id;

    let notificationSent = [];

    if (discordId !== "x") {
      const embed = {
        color: 0x7f6cff,
        title: "Copile Automation",
        url: "https://discord.js.org",
        author: {
          name: "Copile",
          icon_url: "https://i.imgur.com/UMSFUaT.png",
          url: "https://copile.trade",
        },
        description: `>:chart_with_upwards_trend: **NEW POSITION OPENED** :chart_with_upwards_trend:\n\n#${
          tradeData.symbol
        } #${tradeData.side} ${
          tradeData.side === "SHORT"
            ? ":arrow_down: :red_circle:"
            : ":arrow_up: :green_circle:"
        }`,
        thumbnail: {
          url: "https://i.imgur.com/hmcMAtj.png",
        },
        fields: [
          {
            name: "Entry",
            value: tradeData.entry,
          },
          {
            name: "Leverage",
            value: tradeData.leverage,
          },
          {
            name: `Take Profits ${tradeData.take_profits.length}`,
            value: tradeData.take_profits
              .map(
                (tp, index) =>
                  `\`TP${index + 1}:\` ${tp.tp_value} | ${
                    tp.tp_percentage * 100
                  }%`
              )
              .join("\n"),
          },
          {
            name: `Stop Losses ${tradeData.stop_losses.length}`,
            value: tradeData.stop_losses
              .map(
                (sl, index) =>
                  `\`SL${index + 1}:\` ${sl.sl_value} | ${
                    sl.sl_percentage * 100
                  }%`
              )
              .join("\n"),
          },
        ],
        timestamp: new Date().toISOString(),
        footer: {
          text: "Copile Trade Automation",
          icon_url: "https://i.imgur.com/UMSFUaT.png",
        },
      };

      // WORKS
      // const exampleEmbed = {
      //   color: 0x0099ff,
      //   title: "Some title",
      //   url: "https://discord.js.org",
      //   author: {
      //     name: "Some name",
      //     icon_url: "https://i.imgur.com/AfFp7pu.png",
      //     url: "https://discord.js.org",
      //   },
      //   description: "Some description here",
      //   thumbnail: {
      //     url: "https://i.imgur.com/AfFp7pu.png",
      //   },
      //   fields: [
      //     {
      //       name: "Regular field title",
      //       value: "Some value here",
      //     },
      //     {
      //       name: "\u200b",
      //       value: "\u200b",
      //       inline: false,
      //     },
      //     {
      //       name: "Inline field title",
      //       value: "Some value here",
      //       inline: true,
      //     },
      //     {
      //       name: "Inline field title",
      //       value: "Some value here",
      //       inline: true,
      //     },
      //     {
      //       name: "Inline field title",
      //       value: "Some value here",
      //       inline: true,
      //     },
      //   ],
      //   image: {
      //     url: "https://i.imgur.com/AfFp7pu.png",
      //   },
      //   timestamp: new Date().toISOString(),
      //   footer: {
      //     text: "Some footer text here",
      //     icon_url: "https://i.imgur.com/AfFp7pu.png",
      //   },
      // };

      const user = await client.users.fetch(discordId);
      user.send({ embeds: [embed] }).catch((error) => {
        console.error(`Could not send discord DM to ${user.tag}.`, error);
        return res.status(500).json({ success: false, error: error });
      });

      notificationSent.push("Discord");
    }

    if (telegramId !== "x") {
      // Send the Telegram notification

      const message = `:chart_with_upwards_trend: *NEW POSITION OPENED* :chart_with_upwards_trend:\n\n*#${
        tradeData.symbol
      } #${tradeData.side} ${
        tradeData.side === "SHORT"
          ? ":arrow_down: :red_circle:"
          : ":arrow_up: :green_circle:"
      }*\n\n*Entry:* ${tradeData.entry}\n*Leverage:* ${
        tradeData.leverage
      }\n*Take Profits ${
        tradeData.take_profits.length
      }:* ${tradeData.take_profits
        .map(
          (tp, index) =>
            `TP${index + 1}: ${tp.tp_value} | ${tp.tp_percentage * 100}%`
        )
        .join("\n")}\n*Stop Losses ${
        tradeData.stop_losses.length
      }:* ${tradeData.stop_losses
        .map(
          (sl, index) =>
            `SL${index + 1}: ${sl.sl_value} | ${sl.sl_percentage * 100}%`
        )
        .join("\n")}`;

      const { success } = sendTelegramMessage(telegramId, message);

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
    console.error(err);
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

    const userRef = db.collection("users").doc(actionData.user_id);
    const userDoc = await userRef.get();
    const discordId = userDoc.data().discord.id;
    const telegramId = userDoc.data().telegram.id;

    // Get the trade data from Firestore
    const tradeRef = db
      .collection("users")
      .doc(actionData.user_id)
      .collection("trades")
      .doc(actionData.trade_id);
    const tradeDoc = await tradeRef.get();
    const tradeData = tradeDoc.data();

    // example trade data
    // const tradeData = {
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
      const embed = {
        color: 0x7f6cff,
        author: {
          name: "Copile Notifications",
          icon_url: "https://i.imgur.com/UMSFUaT.png",
          url: "https://copile.trade",
        },
        description: `> **TRADE UPDATED**\n\n#${tradeData.symbol} #${
          tradeData.side
        } ${
          tradeData.side === "Buy"
            ? ":arrow_up: :green_circle:"
            : ":arrow_down: :red_circle:"
        }\n\n:bell: **${actionText}** :bell:`,
        thumbnail: {
          url: "https://i.imgur.com/hmcMAtj.png",
        },
        timestamp: new Date().toISOString(),
        footer: {
          text: "Copile Trade Automation",
          icon_url: "https://i.imgur.com/UMSFUaT.png",
        },
      };

      console.log("embed", embed);

      // Send the Discord notification
      // const user = await client.users.fetch(discordId);
      // await user.send({ embeds: [embed] });

      const user = await client.users.fetch(discordId);
      user.send({ embeds: [embed] }).catch((error) => {
        console.error(`Could not send discord DM to ${user.tag}.`, error);
        return res.status(500).json({ success: false, error: error });
      });

      notificationSent.push("Discord");
    }

    if (telegramId !== "x") {
      // Send the Telegram notification
      const message = `*TRADE UPDATED*\n\n*#${tradeData.symbol} #${
        tradeData.side
      } ${
        tradeData.side === "Buy"
          ? ":arrow_up: :green_circle:"
          : ":arrow_down: :red_circle:"
      }*\n\n*${actionText}*`;

      const { success } = sendTelegramMessage(telegramId, message);

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
    console.error(error);
    return res.status(500).json({ success: false, error: error.message });
  }
});
exports.notifications = app;
