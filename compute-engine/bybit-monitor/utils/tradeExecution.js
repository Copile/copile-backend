const {
  handleNewStopLoss,
  handleNewTakeProfit,
  handlePartialClose,
  handleCancelledOrder,
  handelNewOrder
} = require('./tradeHandlers');
const CustomError = require('../firestore/error.js');
const submitTrade = require('../trade/submitTrade.js');

/**
 * Handles various trade operations like storing, deleting, and updating trades.
 * @param {Object} order - The order object containing all the trade information.
 * @returns {Object} - Returns the modified order object.
 */
async function tradeExecution(order) {
  try { 
    switch (order.detection) {
      case 'new_order':
        // Handle new order
        order = await handelNewOrder(order);
        break;

      case 'new_stop_loss':
        // Handle new stop loss
        order = await handleNewStopLoss(order);
        break;

      case 'new_take_profit':
        // Handle new take profit
        order = await handleNewTakeProfit(order);
        break;

      case 'partial_close':
        // Handle partial close
        order = await handlePartialClose(order);
        break;

      case 'cancelled_order':
      case 'cancelled_take_profit':
      case 'cancelled_stop_loss':
        // Handle cancelled orders
        order = await handleCancelledOrder(order);
        break;

      default:
        throw new CustomError({
          message: `Unknown order detection type: ${order.detection}`,
          status: 400,
          source: 'tradeHandling',
        });
    }
    await submitTrade(order);
    return order;
  } catch (error) {
    throw new CustomError({
      message: `Error handling the trade: ${error.message}`,
      status: 500,
      source: 'tradeExecution',
    });
  }
}

module.exports = tradeExecution;
