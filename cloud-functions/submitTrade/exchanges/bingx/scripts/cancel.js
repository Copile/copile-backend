const CustomError = require('../../../utils/error.js');
const { getSpecificOrder, deleteTpSlOrder } = require('../../../utils/firestore.js');


async function sendCancel(session, traderId, tradeId, documentId, tradeType) {
    try {
        let order = await getSpecificOrder(traderId, tradeId, documentId, tradeType)

        await session.cancelOrder(Symbol, null, order.orderId)
        await deleteTpSlOrder(traderId, tradeId, documentId, tradeType)

    } catch(error) {
        throw new CustomError({
            message: `Error cancelling order in scripts: ${error.message}`,
            status: 500,
            source: 'sendCancel',
        });
    }
}

module.exports = sendCancel;