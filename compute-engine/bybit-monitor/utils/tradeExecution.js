const {
  handleNewStopLoss,
  handleNewTakeProfit,
  handlePartialClose,
  handleCancelledOrder,
} = require('./tradeHandlers');
const CustomError = require('../firestore/error.js');
const { storeTrade } = require('../firestore/firestore.js');
const accountId = require('../connection.js');

/**
 * Handles various trade operations like storing, deleting, and updating trades.
 * @param {Object} order - The order object containing all the trade information.
 * @returns {Object} - Returns the modified order object.
 */
async function tradeExecution(order) {
  try {
    console.log(accountId);
    console.log(order);
    switch (order.detection) {
      case 'new_order':
        // Handle new order
        await storeTrade(accountId, order);
        break;

      case 'new_stop_loss':
        // Handle new stop loss
        await handleNewStopLoss(order);
        break;

      case 'new_take_profit':
        // Handle new take profit
        await handleNewTakeProfit(order);
        break;

      case 'partial_close':
        // Handle partial close
        await handlePartialClose(order);
        break;

      case 'cancelled_order':
      case 'cancelled_take_profit':
      case 'cancelled_stop_loss':
        // Handle cancelled orders
        await handleCancelledOrder(order);
        break;

      default:
        throw new CustomError({
          message: `Unknown order detection type: ${order.detection}`,
          status: 400,
          source: 'tradeHandling',
        });
    }

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
