const { storeTrade, storeTP, storeSL, fetchLatestTradeDoc, getTradeInfo, updateTradeQuantity, deleteOrder, deleteTpSlOrder, getSpecficOrder } = require('../firestore/firestore.js');
const { discordMessage } = require('../discord/webhook.js');
const CustomError = require("../firestore/error.js");
const { v4: uuidv4 } = require('uuid');

const accountId = "duelendigerdreckigerbastard"

/*
  Function to handle the general process of 
  storing/deleting/updating data in the db as well as starting the submitTrade process */ 
async function tradeHandling(order) {
    try {
      console.log(order);
      switch(order.detection) {
        case 'new_order':
          await storeTrade(accountId, order);
          break;
        case 'new_stop_loss':
          order.tradeId = await fetchLatestTradeDoc(accountId, order.symbol, "bybit", order.side == "Buy" ? "Sell" : "Buy");
          order.slDocumentId = String(uuidv4());
          order.slNumber = 1
          order.slValue = order.entry
          order.slAmount = order.quantity
          order.slPercentage = 1
          console.log(accountId);
          await storeSL(accountId, order)
          break;
        case 'new_take_profit':
          order.tradeId = await fetchLatestTradeDoc(accountId, order.symbol, "bybit", order.side == "Buy" ? "Sell" : "Buy");
          TpExists = await getSpecficOrder(accountId, order.tradeId, order.orderId, "tp");
          if (TpExists != null) { 
            await deleteTpSlOrder(accountId, order.tradeId, TpExists.documentId, "tp")
          }
          tradeInfo = await getTradeInfo(accountId, order.tradeId);
          order.tpValue = order.entry
          order.tpAmount = order.quantity
          order.tpNumber = 1
          order.tpPercentage = parseFloat((order.quantity / tradeInfo.quantity).toFixed(2))
          order.tpDocumentId = String(uuidv4());
          await storeTP(accountId, order)
          break;
        case 'partial_close':
          order.tradeId = await fetchLatestTradeDoc(accountId, order.symbol, "bybit", order.side == "Buy" ? "Sell" : "Buy");
          tradeInfo = await getTradeInfo(accountId, order.tradeId)
          order.partialPercentage = parseFloat((order.quantity / tradeInfo.quantity).toFixed(2))
          if (order.partialPercentage >= 1) {
            await deleteOrder(accountId, order.tradeId);
          } else {
            await updateTradeQuantity(accountId, order.tradeId, tradeInfo.quantity - order.quantity) 
          }
          break;
        case 'cancelled_order':
          order.tradeId = await fetchLatestTradeDoc(accountId, order.symbol, "bybit", order.side);
          await deleteOrder(accountId, order.tradeId);
          break;
        case 'cancelled_take_profit':
          order.tradeId = await fetchLatestTradeDoc(accountId, order.symbol, "bybit", order.side == "Buy" ? "Sell" : "Buy");
          tpDocument = await getSpecficOrder(accountId, order.tradeId, order.orderId, "tp")
          await deleteTpSlOrder(accountId, order.tradeId, tpDocument.documentId, "tp")
          break;
        case 'cancelled_stop_loss':
          order.tradeId = await fetchLatestTradeDoc(accountId, order.symbol, "bybit", order.side == "Buy" ? "Sell" : "Buy");
          tpDocument = await getSpecficOrder(accountId, order.tradeId, order.orderId, "tp")
          await deleteTpSlOrder(accountId, order.tradeId, tpDocument.documentId, "tp")
          break;
      }
      return order
  } catch(error) {
    throw new CustomError({
      message: `Error handling the trade: ${error.message}`,
      status: 500,
      source: "tradeHandling",
    });
  }
}
  
module.exports = tradeHandling;