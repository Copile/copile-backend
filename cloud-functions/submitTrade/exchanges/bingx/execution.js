const CustomError = require('../../utils/error.js');
const BingXFunctions = require('../bingx/api/perpetual.js');
const { getUserkeys, getTradeInfo } = require('../../utils/firestore.js');
const { convertSymbol, roundToPrecision } = require('../bingx/scripts/settings.js');

async function bulkOrder(apiKey, apiSecret, data) {
    try {
        const session = new BingXFunctions(apiKey, apiSecret);
        const { traderId, tradeId, margin, trader_exchange, marginType } = data;
        const { leverage, entry, take_profits, stop_losses } = data.payload;
        let symbol = data.payload.symbol;

        let orderType = entry != "market" ? "LIMIT" : "MARKET";

        symbol = await convertSymbol(symbol);
        
        const precision = await session.getPrecisions(symbol)

        let quantity;
        if (entry !== "market") {
          quantity = roundToPrecision((parseFloat(margin) * parseInt(leverage) / parseFloat(entry)), precision.quantityPrecision);
        } else {
          const fetchPrice = await session.getMarket(symbol)
          const marketPrice = fetchPrice["lastPrice"];
          quantity = roundToPrecision((parseFloat(margin) * parseInt(leverage) / parseFloat(marketPrice)), precision.quantityPrecision);
        }

        await session.switchMarginMode(symbol, marginType);
        await session.switchLeverage(symbol, side, leverage);

        createOrder = await session.tradeOrder(symbol, orderType, side, entry, quantity, null, null)
        let orderId = createOrder.order.orderId
    




    } catch(error) {
        throw new CustomError({
            message: `Error handling the trade in execution: ${error.message}`,
            status: 500,
            source: 'bulkOrder',
        });
    }
}

async function cancelAllOrders(apiKey, apiSecret, data) {
    try {
        const session = new BingXFunctions(apiKey, apiSecret);
        const { traderId, tradeId } = data;

        const tradeInfo = await getTradeInfo(traderId, tradeId);

        const symbol = tradeInfo.symbol;

        let position = await session.getPosition(symbol)    

        let quantity, positionSide;
        if (position.length !== 0) {
            quantity = position[0]["positionAmt"]
            positionSide = position[0]["positionSide"]

            emergency = await session.tradeOrder(
                symbol,
                "Market",
                positionSide == "LONG" ? "SELL": "BUY",
                null,
                quantity
            )
        } else {
            let orderId = tradeInfo.orderID
            await session.cancelOrder(
                orderId, symbol
            )
        }
        return

    } catch(error) {
        throw new CustomError({
            message: `Error cancelling all orders in execution: ${error.message}`,
            status: 500,
            source: 'cancelAllOrders',
        });
    }
}

async function replaceSl(apiKey, apiSecret, data) {
    try {
        const session = new BingXFunctions(apiKey, apiSecret);
        const { traderId, tradeId, document_id, payload } = data;

        const tradeInfo = await getTradeInfo(traderId, tradeId);

        const precision = await session.getPrecisions(symbol);

        

    } catch(error) {
        throw new CustomError({
            message: `Error replacing SL in execution: ${error.message}`,
            status: 500,
            source: 'replaceSl',
        });
    }
}

module.exports = {
    bulkOrder,
    cancelAllOrders,

};