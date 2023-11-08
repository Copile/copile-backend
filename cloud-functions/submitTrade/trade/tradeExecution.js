const createSession = require('./sessionFactory.js');
const decryptData = require('../utils/decryption.js');
const CustomError = require('../utils/error.js');


async function bulkOrder(apiKey, apiSecret, apiPassphrase, data) {
    
    try {
        const exchange = data.trader_exchange;
        
        const session = createSession(exchange, apiKey, apiSecret, apiPassphrase);
        const tradeExecution = await session.bulkOrder(data);

        return tradeExecution
    } catch(error) {
        throw new CustomError({
            message: `Error handling the trade: ${error.message}`,
            status: 500,
            source: 'bulkOrder',
        });
    }
}
