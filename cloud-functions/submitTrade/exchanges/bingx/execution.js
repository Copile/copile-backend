const CustomError = require('../../utils/error.js');
const BingXFunctions = require('./api/perpetual.js');
const { storeTrade, getUserkeys, getTradeInfo } = require('../../utils/firestore.js');
const { convertSymbol, roundToPrecision } = require('./scripts/settings.js');
const Order = require('./scripts/orderFactory.js');
const calculateTpAmounts = require('./scripts/distribution.js');


async function bulkOrder(apiKey, apiSecret, data) {
    try {
        const session = new BingXFunctions(apiKey, apiSecret);
        const { traderId, tradeId, margin, trader_exchange, marginType } = data;
        const { leverage, entry, take_profits, stop_losses } = data.payload;
        
        let takeProfits = take_profits;
        let stopLosses = stop_losses;

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

        let preparedOrders = []

        preparedOrders.push(new Order(symbol, orderType, side.toUpperCase(), entry, quantity, null, null))

        let newTakeProfits = await calculateTpAmounts(takeProfits, quantity, precision);

        let tpSlPositionSide = side === "Buy" ? "LONG" : "SHORT"

        newTakeProfits.array.forEach(tp => {
            preparedOrders.push(new Order(symbol, "TRIGGER_MARKET", side === "Buy" ? "SELL" : "BUY", tp.tp_value, tp.tp_amount, tpSlPositionSide, tp.tp_value))
        });

        stopLosses.array.forEach(sl => {
            preparedOrders.push(new Order(symbol, "TRIGGER_MARKET", side === "Buy" ? "SELL" : "BUY", sl.sl_value, sl.sl_amount, tpSlPositionSide, tp.tp_value))
        });

        let bulkOrder = await session.bulkOrder(preparedOrders);

        /**
         * createOrder = await session.tradeOrder(symbol, orderType, side, entry, quantity, null, null)
        **/
        let orderId = createOrder.order.orderId
        
        const tradeInfo = {
            tradeId,
            orderId,
            symbol,
            orderType,
            side,
            quantity,
            entry,
            leverage,
            margin,
            "exchange": trader_exchange
        }
        await storeTrade(traderId, tradeInfo);


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