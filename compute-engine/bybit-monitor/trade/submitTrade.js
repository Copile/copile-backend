const {
    bulkOrder,
    bulkTP,
    stopLoss,
    cancelOrder,
    cancelAll,
    partialClose
  } = require("./orderStructure.js");

const { accountId, traderExchange, exchanges } = require("../connection.js")
const addTasktoQueue = require('./addTasktoQueue.js')

async function submitTrade(order) {
    try {
      let body;

      switch (order.detection) {
        case 'new_order':
            // Submit new order
            body = new bulkOrder(accountId, order.tradeId, traderExchange, exchanges, "test", order, [], [])
            break;
  
        case 'new_stop_loss':
            // Submit new stop loss
            body = new stopLoss(accountId, tradeId, order.slDocumentId, order.slNumber, order.slValue, order.slPercentage)
            break;
  
        case 'new_take_profit':
            // Submit new take profit or potential bulkTP
            await handleNewTakeProfit(order);
            break;
  
        case 'partial_close':
            // Submit partial close
            body = new partialClose(accountId, order.tradeId, order.percentage)
            break;
        case 'cancelled_order':
            body = new cancelAll(accountId, order.tradeId)
            break;
        case 'cancelled_stop_loss':
            body = new cancelOrder(accountId, order.tradeId, order.documentId, "sl")
            break;
  
        default:
          throw new CustomError({
            message: `Unknown order detection type: ${order.detection}`,
            status: 400,
            source: 'submitTrade',
          });
      }
      await addTasktoQueue(order.detection, body);

      return order;
    } catch (error) {
      throw new CustomError({
        message: `Error submitting the trade: ${error.message}`,
        status: 500,
        source: 'submitTrade',
      });
    }
  }
  