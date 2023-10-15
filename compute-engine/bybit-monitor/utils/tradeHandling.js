const { storeTrade, storeTP, storeSL, fetchLatestTradeDoc, getTradeInfo } = require('../firestore/firestore.js');
const { v4: uuidv4 } = require('uuid');

const accountId = "duelendigerdreckigerbastard"

async function tradeHandling(order) {
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
          tradeInfo = await getTradeInfo(accountId, order.tradeId)
          order.tpValue = order.entry
          order.tpAmount = order.quantity
          order.tpNumber = 1
          order.tpPercentage = parseFloat((order.quantity / tradeInfo.quantity).toFixed(2))
          order.tpDocumentId = String(uuidv4());
          await storeTP(accountId, order)
          break;
    }
    return order
  }
  
module.exports = tradeHandling;