const BinanceSession = require('../binance/session.js');

async function getQuantity(symbol, orderId, apiKey, apiSecret) {
    const session = new BinanceSession(apiKey, apiSecret);

    const orderQuantity = await session.getOrderQuantity(symbol, orderId);
    return orderQuantity;
}

module.exports = getQuantity;