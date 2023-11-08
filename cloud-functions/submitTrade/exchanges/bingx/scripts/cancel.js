const CustomError = require('../../../utils/error.js');



async function sendCancel(session, tradeId, tradeType, tradeInfo) {
    try {
        


    } catch(error) {
        throw new CustomError({
            message: `Error cancelling order in scripts: ${error.message}`,
            status: 500,
            source: 'sendCancel',
        });
    }
}