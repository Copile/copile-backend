require('dotenv').config({ path: '../.env' });
const {
    bulkOrder,
    bulkTP,
    stopLoss,
    cancelOrder,
    cancelAll,
    partialClose
  } = require("./orderStructure.js");

const accountId = process.env.ACCOUNT_ID;
const traderExchange = process.env.TRADER_EXCHANGE;
const exchanges = process.env.EXCHANGES.split(",");
const plans = [process.env.PLANS];
const { getTpOrders } = require("../firestore/firestore.js");
const addTasktoQueue = require('./addTasktoQueue.js');
const CustomError = require('../firestore/error.js');

// Function to sum up the tp_percentage of each document in the tpOrders array
const sumTpPercentage = (tpOrders) => {
  let totalTpPercentage = 0;

  tpOrders.forEach(tpOrder => {
      if (tpOrder.tp_percentage) {
        totalTpPercentage += tpOrder.tp_percentage;
      }
  });

  return totalTpPercentage;
};

async function submitTrade(order) {
    try {
      let body;

      switch (order.detection) {
        case 'new_order':
            // Submit new order
            body = new bulkOrder(accountId, order.tradeId, traderExchange, exchanges, plans, order, [], [])
            break;
  
        case 'new_stop_loss':
            // Submit new stop loss
            body = new stopLoss(accountId, order.tradeId, order.slDocumentId, order.slNumber, order.slValue, order.slPercentage)
            break;
  
        case 'new_take_profit':
            // Submit new take profit or potential bulkTP
            let tpOrders = await getTpOrders(accountId, order.tradeId);
            sumTp = sumTpPercentage(tpOrders);
            if (sumTp >= 0.98) {
              body = new bulkTP(accountId, order.tradeId, tpOrders)
            }
            break;
        
        case 'partial_close':
            // Submit partial close
            body = new partialClose(accountId, order.tradeId, order.partialPercentage)
            break;
        
        case 'cancelled_order':
            // Submit cancel all orders
            body = new cancelAll(accountId, order.tradeId)
            break;

        case 'cancelled_stop_loss':
            // Cancel stop-loss
            body = new cancelOrder(accountId, order.tradeId, order.documentId, "sl")
            break;
  
        default:
          throw new CustomError({
            message: `Unknown order detection type: ${order.detection}`,
            status: 400,
            source: 'submitTrade',
          });
      }
      body !== undefined ? await addTasktoQueue(accountId, order.detection, body) : console.log("Take-Profits didn't reach 100 % yet!")

      return order;
    } catch (error) {
      throw new CustomError({
        message: `Error submitting the trade: ${error.message}`,
        status: 500,
        source: 'submitTrade',
      });
    }
  }

module.exports = submitTrade;