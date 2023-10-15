const { storeTP, storeSL, fetchLatestTradeDoc, getTradeInfo } = require('../firestore/firestore.js');
const { v4: uuidv4 } = require('uuid');

async function reformatOrder(accountId, order) {
    order.tradeId = await fetchLatestTradeDoc(accountId, order.symbol, "bybit", order.side == "Buy" ? "Sell" : "Buy");
    switch(order.action) {
        case 'new_stop_loss':
            order.slDocumentId = String(uuidv4());
            order.slNumber = 1
            order.slValue = order.entry
            order.slAmount = order.quantity
            order.slPercentage = 1
            console.log(accountId);
            await storeSL(accountId, order)
            break;
        case 'new_take_profit':
            tradeQuantity = await getTradeInfo(accountId, order.tradeId)["quantity"]
            order.tpValue = order.entry
            order.tpAmount = order.quantity
            order.tpPercentage = parseFloat((order.quantity / tradeQuantity).toFixed(2))
            order.tpDocumentId = String(uuidv4());
            await storeTP(accountId, order)
            break;
    }
    return order
};   

module.exports = reformatOrder;