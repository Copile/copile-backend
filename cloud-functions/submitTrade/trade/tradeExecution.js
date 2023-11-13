const createSession = require('./sessionFactory.js');
const CustomError = require('../utils/error.js');

async function tradeExecution(apiKey, apiSecret, apiPassphrase, method, data) {
    
    try {


        // THIS IS ALL FOR TESTING PURPOSES CODE NOT FINISHED
        // THIS IS ALL FOR TESTING PURPOSES CODE NOT FINISHED
        // THIS IS ALL FOR TESTING PURPOSES CODE NOT FINISHED
        // THIS IS ALL FOR TESTING PURPOSES CODE NOT FINISHED
        let exchange;
        let session;
        let tradeExecution;
        switch(method) {
            case 'bulkOrder':
                exchange = data.trader_exchange;
                session = createSession(exchange, apiKey, apiSecret, apiPassphrase);
                tradeExecution = await session.bulkOrder(data);
                break;
            case 'sendSl':
                exchange = data.trader_exchange;
                session = createSession(exchange, apiKey, apiSecret, apiPassphrase);
                tradeExecution = await session.sendSl(data);
                break;
            case 'replaceSL':
                exchange = data.trader_exchange;
                session = createSession(exchange, apiKey, apiSecret, apiPassphrase);
                tradeExecution = await session.replaceSL(data);
                break;
            case 'bulkTP':
                exchange = data.trader_exchange;
                session = createSession(exchange, apiKey, apiSecret, apiPassphrase);
                tradeExecution = await session.bulkTP(data);
                break;
            case 'cancelOrder':
                exchange = data.trader_exchange;
                session = createSession(exchange, apiKey, apiSecret, apiPassphrase);
                tradeExecution = await session.cancelOrder(data);
                break;
            case 'cancelAllTPs':
                exchange = data.trader_exchange;
                session = createSession(exchange, apiKey, apiSecret, apiPassphrase);
                tradeExecution = await session.cancelAllTPs(data);
                break;
            case 'cancelAllOrders':
                exchange = data.trader_exchange;
                session = createSession(exchange, apiKey, apiSecret, apiPassphrase);
                tradeExecution = await session.cancelAllOrders(data);
                break;
            case 'partialClose':
                exchange = data.trader_exchange;
                session = createSession(exchange, apiKey, apiSecret, apiPassphrase);
                tradeExecution = await session.partialClose(data);
                break;
        }

        return tradeExecution
    } catch(error) {
        throw new CustomError({
            message: `Error handling the trade: ${error.message}`,
            status: 500,
            source: 'tradeExecution',
        });
    }
}

module.exports = tradeExecution;