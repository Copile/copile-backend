const {
    fetchLatestTradeDoc,
    getTradeInfo,
    storeSL,
    storeTP,
    deleteOrder,
    deleteTpSlOrder,
    getSpecficOrder,
    storeTrade,
    updateTradeQuantity
    } = require('../firestore/firestore.js');
const { v4: uuidv4 } = require('uuid');
const CustomError = require('../firestore/error.js');
require('dotenv').config({ path: '../.env' });
const accountId = process.env.ACCOUNT_ID;

async function handelNewOrder(order) {
  try {
    let tradeId = String(uuidv4());
    order.tradeId = tradeId;
    await storeTrade(accountId, order);
    return order;
  } catch (error) {
    throw new CustomError({
      message: `Error storing the trade: ${error.message}`,
      status: 500,
      source: 'handelNewOrder',
    });
  }
}

async function handleNewStopLoss(order) {
  try {
    order.tradeId = await fetchLatestTradeDoc(accountId, order.symbol, 'bybit', order.side === 'Buy' ? 'Sell' : 'Buy');
    order.slDocumentId = String(uuidv4());
    order.slNumber = 1;
    order.slValue = order.entry;
    order.slAmount = order.quantity;
    order.slPercentage = 1;

    await storeSL(accountId, order);
    return order;
  } catch (error) {
    throw new CustomError({
      message: `Error storing the stop-loss: ${error.message}`,
      status: 500,
      source: 'handleNewStopLoss',
    });
  }
}

async function handleNewTakeProfit(order) {
  try {
    order.tradeId = await fetchLatestTradeDoc(accountId, order.symbol, 'bybit', order.side === 'Buy' ? 'Sell' : 'Buy');
    const TpExists = await getSpecficOrder(accountId, order.tradeId, order.orderId, 'tp');
    if (TpExists !== null) {
      await deleteTpSlOrder(accountId, order.tradeId, TpExists.documentId, 'tp');
    }

    const tradeInfo = await getTradeInfo(accountId, order.tradeId);
    order.tpValue = order.entry;
    order.tpAmount = order.quantity;
    order.tpNumber = 1;
    order.tpPercentage = parseFloat((order.quantity / tradeInfo.quantity).toFixed(2));
    order.tpDocumentId = String(uuidv4());

    await storeTP(accountId, order);
    return order;
  } catch (error) {
    throw new CustomError({
      message: `Error storing the take-profit: ${error.message}`,
      status: 500,
      source: 'handleNewTakeProfit',
    });
  }
}

async function handlePartialClose(order) {
  try {
    order.tradeId = await fetchLatestTradeDoc(accountId, order.symbol, 'bybit', order.side === 'Buy' ? 'Sell' : 'Buy');
    const tradeInfo = await getTradeInfo(accountId, order.tradeId);

    order.partialPercentage = parseFloat((order.quantity / tradeInfo.quantity).toFixed(2));

    if (order.partialPercentage >= 1) {
      await deleteOrder(accountId, order.tradeId);
    } else {
      await updateTradeQuantity(accountId, order.tradeId, tradeInfo.quantity - order.quantity);
    }
    return order;
  } catch (error) {
    throw new CustomError({
      message: `Error handling partial close: ${error.message}`,
      status: 500,
      source: 'handlePartialClose',
    });
  }
}

async function handleCancelledOrder(order) {
  try {
    order.tradeId = await fetchLatestTradeDoc(accountId, order.symbol, 'bybit', order.side === 'Buy' ? 'Sell' : 'Buy');
    const tpSlDocument = await getSpecficOrder(accountId, order.tradeId, order.orderId, 'tp');
    order.documentId = tpSlDocument.documentId;

    if (order.detection === 'cancelled_order') {
      await deleteOrder(accountId, order.tradeId);
    } else {
      await deleteTpSlOrder(accountId, order.tradeId, order.documentId, 'tp');
    }
    return order;
  } catch (error) {
    throw new CustomError({
      message: `Error handling cancelled order: ${error.message}`,
      status: 500,
      source: 'handleCancelledOrder',
    });
  }
}

module.exports = {
    handleNewStopLoss,
    handleNewTakeProfit,
    handlePartialClose,
    handleCancelledOrder,
    handelNewOrder
};