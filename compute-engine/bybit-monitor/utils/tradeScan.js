const { fetchLatestTradeDoc } = require('../firestore/firestore.js');
const accountId = process.env.ACCOUNT_ID;
const submitTrade = require('../trade/submitTrade.js');
const CustomError = require('../firestore/error.js');
const exchange = process.env.TRADER_EXCHANGE

async function tradeScan(orders) {
    try {
        let orders_length = orders.length;
        for (let i = 0; i < orders_length; i++) {
            let tradeSide = orders[i].side;
            if (orders[i].detection !== 'cancelled_order') {
                tradeSide = orders[i].side === 'Buy' ? 'Sell' : 'Buy';
            }

            orders[i].tradeId = await fetchLatestTradeDoc(accountId, orders[i].symbol, exchange, tradeSide);
        }

        const [filteredOrders, leftOutOrders] = filterDuplicateTradeIds(orders);

        // Perform an action with leftOutOrders
        for (const order of leftOutOrders) {
            if (order.detection === 'partial_close') {
                await submitTrade(order);
            }
        }

        return filteredOrders;
    } catch(error) {
        throw new CustomError({
            message: `Error scanning the trade: ${error.message}`,
            status: 500,
            source: 'tradeScan',
        });
    }
}

function filterDuplicateTradeIds(orders) {
    try {
        const tradeIdCount = {};
        const filteredOrders = [];
        const leftOutOrders = [];

        // Count the occurrences of each tradeId
        for (const order of orders) {
            tradeIdCount[order.tradeId] = (tradeIdCount[order.tradeId] || 0) + 1;
        }

        // Filter orders based on your conditions
        for (const order of orders) {
            if (tradeIdCount[order.tradeId] > 1) {
                if (order.detection !== 'partial_close' &&
                    order.detection !== 'cancelled_take_profit' &&
                    order.detection !== 'cancelled_stop_loss') {
                    filteredOrders.push(order);
                } else {
                    leftOutOrders.push(order);
                }
            } else {
                filteredOrders.push(order);
            }
        }

        return [filteredOrders, leftOutOrders];
    } catch(error) {
        throw new CustomError({
            message: `Error filtering the tradeIds: ${error.message}`,
            status: 500,
            source: 'filterDuplicateTradeIds',
        });
    }
}

module.exports = tradeScan;