const {
  handleNewStopLoss,
  handleNewTakeProfit,
  handlePartialClose,
  handleCancelledOrder,
  handleNewOrder
} = require('./tradeHandlers');
const CustomError = require('../firestore/error.js');
const submitTrade = require('../trade/submitTrade.js');
const tradeScan = require('../utils/tradeScan.js')

/**
 * Handles various trade operations like storing, deleting, and updating trades.
 * @param {Object} order - The order object containing all the trade information.
 * @returns {Object} - Returns the modified order object.
 */

async function tradeExecution(orders) {
  try {
    // Checking if any order is a partial_close order
    const hasPartialClose = orders.some(order => order.detection === 'partial_close');

    let processedOrders = []; 

    // If any order has "partial_close", send all orders to tradeScan to see if they belong together
    if (hasPartialClose) {
      orders = await tradeScan(orders);
    }
    let orders_length = orders.length;

    for (let i = 0; i < orders_length; i++) {
      let order;
      switch (orders[i].detection) {
        case 'new_order':
          // Handle new order
          order = await handleNewOrder(orders[i]);
          break;

        case 'new_stop_loss':
          // Handle new stop loss
          order = await handleNewStopLoss(orders[i]);
          break;
          
        case 'new_take_profit':
          // Handle new take profit
          order = await handleNewTakeProfit(orders[i]);
          break;

        case 'partial_close':
          // Handle partial close
          order = await handlePartialClose(orders[i]);
          break;

        case 'cancelled_order':
        case 'cancelled_take_profit':
        case 'cancelled_stop_loss':
          // Handle cancelled orders
          order = await handleCancelledOrder(orders[i]);
          break;
      }
      await submitTrade(order);
      processedOrders.push(order);  
    }

    return processedOrders;

  } catch (error) {
    throw new CustomError({
      message: `Error handling the trade: ${error.message}`,
      status: 500,
      source: 'tradeExecution',
    });
  }
}

module.exports = tradeExecution;
