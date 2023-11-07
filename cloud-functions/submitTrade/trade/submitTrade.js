const createSession = require('./sessionFactory.js');
const decryptData = require('../utils/decryption.js');
const CustomError = require('../utils/error.js');


async function bulkOrder(apiKey, apiSecret, apiPassphrase, payload) {
    
    try {
        const exchange = payload.traderExchange;
        
        const session = createSession(exchange, apiKey, apiSecret, apiPassphrase);
        const tradeExecution = await session.bulkOrder(payload);

        return tradeExecution
    } catch(error) {
        throw new CustomError({
            message: `Error handling the trade: ${error.message}`,
            status: 500,
            source: 'bulkOrder',
        });
    }
}
