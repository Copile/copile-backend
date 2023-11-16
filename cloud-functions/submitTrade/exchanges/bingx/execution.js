const CustomError = require('../../utils/error.js');
const BingXFunctions = require('./api/perpetual.js');
const { storeTrade, storeTP, storeSL, getTradeInfo, getTpOrders, updateTradeQuantity, getTpSlOrders, getSpecificOrder } = require('../../utils/firestore.js');
const { convertSymbol, roundToPrecision } = require('./scripts/settings.js');
const sendCancel = require('./scripts/cancel.js');
const Order = require('./scripts/orderFactory.js');
const calculateTpAmounts = require('./scripts/distribution.js');
const distributionPercentages = require('../../utils/partial.js');
const { getTpsStatus } = require('./scripts/order.js');
const { v4: uuidv4 } = require('uuid');

async function bulkOrder(apiKey, apiSecret, data) {
    try {
        const session = new BingXFunctions(apiKey, apiSecret);
        const { traderId, tradeId, margin, trader_exchange, marginType } = data;
        const { side, leverage, entry, take_profits, stop_losses } = data.payload;
        console.log(data);
        let takeProfits = take_profits;
        let stopLosses = stop_losses;

        let symbol = data.payload.symbol;

        let orderType = entry != "market" ? "LIMIT" : "MARKET";

        // Convert the symbol to the format needed for bingx
        symbol = await convertSymbol(symbol);

        const getPrecisionPromise = session.getPrecisions(symbol);
        const switchMarginModePromise = session.switchMarginMode(symbol, marginType);
        const setLeveragePromise = session.setLeverage(symbol, side, leverage);
    
        const [precision] = await Promise.all([getPrecisionPromise, switchMarginModePromise, setLeveragePromise]);

        // Calculate the quantity for the main order depends on if market or limit order
        let quantity;
        if (entry !== "market") {
          quantity = roundToPrecision((parseFloat(margin) * parseInt(leverage) / parseFloat(entry)), precision.quantityPrecision);
        } else {
          const fetchPrice = await session.getMarket(symbol)
          const marketPrice = fetchPrice["lastPrice"];
          quantity = roundToPrecision((parseFloat(margin) * parseInt(leverage) / parseFloat(marketPrice)), precision.quantityPrecision);
        }

        let preparedOrders = [];

        let orderId = String(uuidv4())
        preparedOrders.push(new Order(symbol, orderType, side.toUpperCase(), entry === "market" ? null : entry, quantity, side === "Buy" ? "LONG" : "SHORT", null, orderId))

        let newTakeProfits = await calculateTpAmounts(takeProfits, quantity, precision);

        let tpSlPositionSide = side === "Buy" ? "LONG" : "SHORT"

        let tpPrice;
        newTakeProfits.forEach(tp => {
            tp.orderId = String(uuidv4());
            tp.tradeId = tradeId;
            tpPrice = roundToPrecision(parseFloat(tp.tp_value), precision.pricePrecision);
            preparedOrders.push(new Order(symbol, "TRIGGER_MARKET", side === "Buy" ? "SELL" : "BUY", null, tp.tp_amount, tpSlPositionSide, tpPrice, tp.orderId));
        });
        
        let slPrice;
        stopLosses.forEach(sl => {
            sl.orderId = String(uuidv4());
            sl.tradeId = tradeId;
            slPrice = roundToPrecision(parseFloat(sl.sl_value), precision.pricePrecision);
            sl.sl_amount = roundToPrecision(parseFloat(quantity) * parseFloat(sl.sl_percentage), precision.quantityPrecision)
            preparedOrders.push(new Order(symbol, "TRIGGER_MARKET", side === "Buy" ? "SELL" : "BUY", null, sl.sl_amount, tpSlPositionSide, slPrice, sl.orderId));
        });

        await Promise.all(preparedOrders.map(order => session.tradeOrder(order)));

        // Store trade info
        const tradeInfo = {
            tradeId,
            orderId,
            symbol,
            "type": orderType,
            side,
            quantity,
            entry,
            leverage,
            margin,
            "exchange": trader_exchange
        }

        // Storing trade/takeprofits/stoplosses concurrently
        const tradePromise = storeTrade(traderId, tradeInfo)
        const tpPromises = newTakeProfits.map(tp => storeTP(traderId, tp));
        const slPromises = stopLosses.map(sl => storeSL(traderId, sl));
        await Promise.all([tradePromise, ...tpPromises, ...slPromises]);

        return

    } catch(error) {
        throw new CustomError({
            message: `Error handling the trade in execution: ${error.message}`,
            status: 500,
            source: 'bulkOrder',
        });
    }
}

async function sendSl(apiKey, apiSecret, data) {
    try {
        const session = new BingXFunctions(apiKey, apiSecret);
        const { traderId, tradeId, document_id, payload } = data;

        const tradeInfo = await getTradeInfo(traderId, tradeId);
        const precision = await session.getPrecisions(symbol);

        let side = tradeInfo.side;
        let slPositionSide = side.toUpperCase() === "BUY" ? "LONG" : "SHORT"

        let position = await session.getPosition(symbol);

        let positionQuantity;
        if (position.length !== 0) {
            positionQuantity = Math.abs(parseFloat(position[0].positionAmt))
        } else {
            positionQuantity = tradeInfo.quantity;
        }

        let orderId = String(uuidv4());

        let price = roundToPrecision(parseFloat(payload.sl_value), precision.pricePrecision);

        let order = new Order(symbol, "TRIGGER_MARKET", side === "Buy" ? "SELL" : "BUY", price, positionQuantity, slPositionSide, price, orderId)

        await session.tradeOrder(order);

        payload.orderId = orderId;
        payload.sl_amount = positionQuantity;
        await storeSL(traderId, payload)

        return

    } catch(error) {
        throw new CustomError({
            message: `Error submitting SL in execution: ${error.message}`,
            status: 500,
            source: 'sendSl',
        });
    }
}

async function replaceSl(apiKey, apiSecret, data) {
    try {
        const session = new BingXFunctions(apiKey, apiSecret);
        const { traderId, tradeId, document_id, payload } = data;

        const tradeInfo = await getTradeInfo(traderId, tradeId);

        let side = tradeInfo.side;
        let slPositionSide = side.toUpperCase() === "BUY" ? "LONG" : "SHORT"

        // Cancel the current stoploss
        await sendCancel(session, tradeInfo.symbol, traderId, tradeId, document_id, "sl")      

        let position = await session.getPosition(symbol);

        let positionQuantity;
        if (position.length !== 0) {
            positionQuantity = Math.abs(parseFloat(position[0].positionAmt))
        } else {
            positionQuantity = tradeInfo.quantity;
        }

        let orderId = String(uuidv4());
        let price = roundToPrecision(parseFloat(payload.sl_value), precision.pricePrecision);

        let order = new Order(symbol, "TRIGGER_MARKET", side === "Buy" ? "SELL" : "BUY", price, positionQuantity, slPositionSide, price, orderId)

        await session.tradeOrder(order);

        payload.orderId = orderId;
        payload.sl_amount = positionQuantity;
        await storeSL(traderId, payload)

        return

    } catch(error) {
        throw new CustomError({
            message: `Error replacing SL in execution: ${error.message}`,
            status: 500,
            source: 'replaceSl',
        });
    }
}

async function cancelOrder(apiKey, apiSecret, data) {
    try {
        const session = new BingXFunctions(apiKey, apiSecret);
        const { traderId, tradeId, document_id, trade_type } = data;

        const tradeInfo = await getTradeInfo(traderId, tradeId);
        let orders = await session.currentOrders(tradeInfo.symbol);
        console.log(BigInt(orders.orders[0].orderId));
        await session.getOrder(tradeInfo.symbol, BigInt(orders.orders[0].orderId), null);
        await sendCancel(session, tradeInfo.symbol, traderId, tradeId, document_id, trade_type)   
        
        return

    } catch(error) {
        throw new CustomError({
            message: `Error cancelling order in execution: ${error.message}`,
            status: 500,
            source: 'cancelOrder',
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

            let emergencySide = positionSide == "LONG" ? "SELL": "BUY"
            let orderId = String(uuidv4())

            let emergencyOrder = new Order(symbol, "MARKET", emergencySide, null, quantity, positionSide, null, orderId);

            emergency = await session.tradeOrder(emergencyOrder);

        } else {
            let orderId = tradeInfo.orderID
            await session.cancelOrder(symbol, null, orderId)
        }

        await session.cancelAllOrders(symbol);

        return

    } catch(error) {
        throw new CustomError({
            message: `Error cancelling all orders in execution: ${error.message}`,
            status: 500,
            source: 'cancelAllOrders',
        });
    }
}

async function cancelAllTps(apiKey, apiSecret, data) {
    try {
        const session = new BingXFunctions(apiKey, apiSecret);
        const { traderId, tradeId } = data;

        const tradeInfoPromise = getTradeInfo(traderId, tradeId);
        const tpOrdersPromise = getTpOrders(traderId, tradeId);

        const [tradeInfo, tpOrders] = await Promise.all([tradeInfoPromise, tpOrdersPromise]);
        
        let symbol = tradeInfo.symbol;

        await Promise.all(tpOrders.map(order => session.cancelOrder(symbol, null, order.orderID)));

        return

    } catch(error) {
        throw new CustomError({
            message: `Error cancelling all tps in execution: ${error.message}`,
            status: 500,
            source: 'cancelAllTps',
        });
    }
}

async function bulkTp(apiKey, apiSecret, data) {
    try {
        const session = new BingXFunctions(apiKey, apiSecret);
        const { traderId, tradeId, take_profits } = data;

        const tradeInfo = await getTradeInfo(traderId, tradeId);
        const symbol = tradeInfo.symbol;

        let takeProfits = take_profits;

        const precision = await session.getPrecisions(symbol);

        let newTakeProfits = await calculateTpAmounts(takeProfits, quantity, precision);

        let preparedOrders = [];

        let side = tradeInfo.side;
        let tpPositionSide = side === "BUY" ? "LONG" : "SHORT"

        let tpPrice;
        newTakeProfits.forEach(tp => {
            tp.orderId = String(uuidv4());
            tpPrice = roundToPrecision(parseFloat(tp.tp_value), precision.pricePrecision);
            preparedOrders.push(new Order(symbol, "TRIGGER_MARKET", side === "Buy" ? "SELL" : "BUY", tpPrice, tp.tp_amount, tpPositionSide, tpPrice, tp.orderId));
        });

        await Promise.all(preparedOrders.map(order => session.tradeOrder(order)));

        const tpPromises = newTakeProfits.map(tp => storeTP(traderId, tp));

        await Promise.all([...tpPromises]);

        return

    } catch(error) {
        throw new CustomError({
            message: `Error handling takeprofits in execution: ${error.message}`,
            status: 500,
            source: 'bulkTp',
        });
    }
}

async function partialClose(apiKey, apiSecret, data) {
    try {
        const session = new BingXFunctions(apiKey, apiSecret);
        const { traderId, tradeId, percentage } = data;

        const tradeInfoPromise = getTradeInfo(traderId, tradeId);
        const TpSlOrdersPromise = getTpSlOrders(traderId, tradeId);

        const [tradeInfo, TpSlOrders] = await Promise.all([tradeInfoPromise, TpSlOrdersPromise]);

        let tpOrders = TpSlOrders.filter(order => order.tradeType === 'tp');
        let slOrders = TpSlOrders.filter(order => order.tradeType === 'sl');

        let side = tradeInfo.side;
        let tpSlPositionSide = side.toUpperCase() === "BUY" ? "LONG" : "SHORT"

        let symbol = tradeInfo.symbol;

        const precisionPromise = session.getPrecisions(symbol);
        const positionPromise = session.getPosition(symbol);

        const [precision, position] = await Promise.all([precisionPromise, positionPromise]);

        let positionQuantity;
        let executed;
        if (position.length !== 0) {
            executed = true
            positionQuantity = Math.abs(parseFloat(position[0].positionAmt))
        } else {
            executed = false
            positionQuantity = tradeInfo.quantity;
        }

        const quantityToSell = parseFloat((parseFloat(positionQuantity) * percentage).toFixed(precision.quantityPrecision));

        let tpsData = await getTpsStatus(session, symbol, tpOrders);
        let takeProfits = distributionPercentages(tpsData);

        let newTakeProfits = await calculateTpAmounts(takeProfits, newQuantity, precision)

        await session.cancelAllOrders(symbol);

        let preparedOrders = [];

        if (executed) {
            let sellOrder = new Order(symbol, "MARKET", side == "SELL" ? "BUY" : "SELL", null, positionQuantity, tpSlPositionSide, null, null);
            await session.tradeOrder(sellOrder);
            await updateTradeQuantity(traderId, tradeId, newQuantity);

        } else {
            const newQuantity = parseFloat((parseFloat(positionQuantity) - quantityToSell).toFixed(precision.quantityPrecision));

            let orderId = String(uuidv4()); 
            let order = new Order(symbol, "LIMIT", side.toUpperCase(), tradeInfo["entry"], newQuantity, null, null, orderId)
            
            await session.tradeOrder(order);
            await updateTradeQuantity(traderId, tradeId, newQuantity);
        }

        let tpPrice;
        newTakeProfits.forEach(tp => {
            tp.orderId = String(uuidv4());
            tpPrice = roundToPrecision(parseFloat(tp.tp_value), precision.pricePrecision);
            preparedOrders.push(new Order(symbol, "TRIGGER_MARKET", side === "Buy" ? "SELL" : "BUY", tpPrice, tp.tp_amount, tpSlPositionSide, tpPrice, tp.orderId));
        });

        let slPrice;
        slOrders.forEach(sl => {
            sl.orderId = String(uuidv4());
            slPrice = roundToPrecision(parseFloat(sl.sl_value), precision.pricePrecision);
            preparedOrders.push(new Order(symbol, "TRIGGER_MARKET", side === "Buy" ? "SELL" : "BUY", slPrice, sl.sl_amount, tpSlPositionSide, slPrice, sl.orderId));
        });

        await Promise.all(preparedOrders.map(order => session.tradeOrder(order)));

        const tpPromises = newTakeProfits.map(tp => storeTP(traderId, tp));
        const slPromises = slOrders.map(sl => storeSL(traderId, sl));
        await Promise.all([...tpPromises, ...slPromises]);

        return

    } catch(error) {
        throw new CustomError({
            message: `Error partially closing trade in execution: ${error.message}`,
            status: 500,
            source: 'partialClose',
        });
    }
}


module.exports = {
    bulkOrder,
    cancelAllOrders,
    replaceSl,
    cancelAllTps,
    bulkTp,
    partialClose,
    sendSl,
    cancelOrder
};