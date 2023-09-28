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

function constructTradeEmbed(tradeBody) {
  const tradeData = tradeBody.data;
  const tradeSide = tradeData.order.side === "Buy" ? "LONG" : "SHORT";
  const isLong = tradeData.order.side === "Buy";

  console.log("tradeBody", tradeBody);
  console.log("tradeData", tradeData);

  const embed = {
    color: 0x2c2f33,
    title: "Copile Notifications",
    description: `> **NEW __${tradeSide}__ POSITION OPENED** ${
      isLong ? ":green_circle:" : ":red_circle:"
    }`,
    fields: [
      {
        name: "---------------------------------------------------------------------",
        value: "__**DETAILS**__",
      },
      {
        name: "Symbol",
        value: tradeData.order.symbol,
        inline: true,
      },
      {
        name: "Entry",
        value: `$${tradeData.order.entry}`,
        inline: true,
      },
      {
        name: "Leverage",
        value: `${tradeData.order.leverage}x`,
        inline: true,
      },
      {
        name: "---------------------------------------------------------------------",
        value: "__**ORDERS**__",
      },
      {
        name: `Take Profits (${tradeData.take_profits.length})`,
        value: tradeData.take_profits
          .map((tp, index) => `${tp.tp_value} | **${tp.tp_percentage * 100}%**`)
          .join("\n"),
        inline: true,
      },
      {
        name: `Stop Losses (${tradeData.stop_losses.length})`,
        value: tradeData.stop_losses
          .map((sl, index) => `${sl.sl_value} | **${sl.sl_percentage * 100}%**`)
          .join("\n"),
        inline: true,
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
  const tradeSide = fireStoreTradeData.side === "Buy" ? "LONG" : "SHORT";
  const isLong = fireStoreTradeData.side === "Buy";

  console.log("fireStoreTradeData", fireStoreTradeData);
  console.log("actionText", actionText);

  const embed = {
    color: 0x2c2f33,
    title: "Copile Notifications",
    description: `> :bellhop: ***TRADE UPDATED*** :bellhop:`,
    fields: [
      {
        name: "---------------------------------------------------------------------",
        value: "__**UPDATE DETAILS**__",
      },
      {
        name: "Symbol",
        value: fireStoreTradeData.symbol,
        inline: true,
      },
      {
        name: "Entry",
        value: `$${fireStoreTradeData.entry}`,
        inline: true,
      },
      {
        name: "Leverage",
        value: `${fireStoreTradeData.leverage}x`,
        inline: true,
      },
      {
        name: "Update",
        value: `> **${actionText}** `,
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

module.exports = {
  sendTelegramMessage,
  fetchUserData,
  fetchFirestoreTradeData,
  constructTradeEmbed,
  constructActionEmbed,
};
