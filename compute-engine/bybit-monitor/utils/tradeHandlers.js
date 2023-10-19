const {
    fetchLatestTradeDoc,
    getTradeInfo,
    storeSL,
    storeTP,
    deleteOrder,
    deleteTpSlOrder,
    getSpecficOrder,
    } = require('../firestore/firestore.js');

const { v4: uuidv4 } = require('uuid');
const {accountId} = require("../connection.js")

async function handleNewStopLoss(order) {
    // Initialize and populate new stop-loss properties
    order.tradeId = await fetchLatestTradeDoc(accountId, order.symbol, 'bybit', order.side === 'Buy' ? 'Sell' : 'Buy');
    order.slDocumentId = String(uuidv4());
    order.slNumber = 1;
    order.slValue = order.entry;
    order.slAmount = order.quantity;
    order.slPercentage = 1;
  
    // Store the new stop-loss in the database
    await storeSL(accountId, order);
}
  
async function handleNewTakeProfit(order) {
    // Fetch existing TP and delete if it exists
    order.tradeId = await fetchLatestTradeDoc(accountId, order.symbol, 'bybit', order.side === 'Buy' ? 'Sell' : 'Buy');
    const TpExists = await getSpecficOrder(accountId, order.tradeId, order.orderId, 'tp');
    if (TpExists !== null) {
      await deleteTpSlOrder(accountId, order.tradeId, TpExists.documentId, 'tp');
    }
  
    // Initialize and populate new take-profit properties
    const tradeInfo = await getTradeInfo(accountId, order.tradeId);
    order.tpValue = order.entry;
    order.tpAmount = order.quantity;
    order.tpNumber = 1;
    order.tpPercentage = parseFloat((order.quantity / tradeInfo.quantity).toFixed(2));
    order.tpDocumentId = String(uuidv4());
  
    // Store the new take-profit in the database
    await storeTP(accountId, order);
}
  
async function handlePartialClose(order) {
    // Fetch existing trade information
    order.tradeId = await fetchLatestTradeDoc(accountId, order.symbol, 'bybit', order.side === 'Buy' ? 'Sell' : 'Buy');
    const tradeInfo = await getTradeInfo(accountId, order.tradeId);
  
    // Calculate the percentage of the trade that is being partially closed
    order.partialPercentage = parseFloat((order.quantity / tradeInfo.quantity).toFixed(2));
  
    // Delete or update the trade based on the calculated percentage
    if (order.partialPercentage >= 1) {
      await deleteOrder(accountId, order.tradeId);
    } else {
      await updateTradeQuantity(accountId, order.tradeId, tradeInfo.quantity - order.quantity);
    }
}
  
async function handleCancelledOrder(order) {
    // Fetch the latest trade document
    order.tradeId = await fetchLatestTradeDoc(accountId, order.symbol, 'bybit', order.side === 'Buy' ? 'Sell' : 'Buy');
  
    // Fetch specific TP or SL document
    const tpSlDocument = await getSpecficOrder(accountId, order.tradeId, order.orderId, 'tp');
    order.documentId = tpSlDocument.documentId
    // Delete the order or TP/SL based on the detection type
    if (order.detection === 'cancelled_order') {
      await deleteOrder(accountId, order.tradeId);
    } else {
      await deleteTpSlOrder(accountId, order.tradeId, order.documentId, 'tp');
    }
}

module.exports = {
    handleNewStopLoss,
    handleNewTakeProfit,
    handlePartialClose,
    handleCancelledOrder,
};