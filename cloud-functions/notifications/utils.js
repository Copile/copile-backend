const Firestore = require("@google-cloud/firestore");
const db = new Firestore();
const axios = require("axios");

const TELEGRAM_BOT_KEY = process.env.TELEGRAM_BOT_KEY;

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

async function fetchUserData(userId) {
  const userRef = db.collection("users").doc(userId);
  const userDoc = await userRef.get();
  return userDoc.data();
}

async function fetchFirestoreTradeData(userId, tradeId) {
  const tradeRef = db
    .collection("users")
    .doc(userId)
    .collection("trades")
    .doc(tradeId);
  const tradeDoc = await tradeRef.get();
  const fireStoreTradeData = tradeDoc.data();

  return fireStoreTradeData;
}

function constructTradeEmbed(tradeData) {
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
        name: `Take Profits ${tradeData.take_profits?.length}`,
        value: tradeData.take_profits
          .map(
            (tp, index) =>
              `\`TP${index + 1}:\` ${tp.tp_value} | ${tp.tp_percentage * 100}%`
          )
          .join("\n"),
      },
      {
        name: `Stop Losses ${tradeData.stop_losses?.length}`,
        value: tradeData.stop_losses
          .map(
            (sl, index) =>
              `\`SL${index + 1}:\` ${sl.sl_value} | ${sl.sl_percentage * 100}%`
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

  return embed;
}

function constructActionEmbed(fireStoreTradeData, actionText) {
  const embed = {
    color: 0x7f6cff,
    author: {
      name: "Copile Notifications",
      icon_url: "https://i.imgur.com/UMSFUaT.png",
      url: "https://copile.trade",
    },
    description: `> **TRADE UPDATED**\n\n#${fireStoreTradeData.symbol} #${
      fireStoreTradeData.side
    } ${
      fireStoreTradeData.side === "Buy"
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

  return embed;
}

module.exports = {
  sendTelegramMessage,
  fetchUserData,
  fetchFirestoreTradeData,
  constructTradeEmbed,
  constructActionEmbed,
};
