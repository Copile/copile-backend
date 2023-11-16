// getAction.js for KuCoin
function getAction(data) {
    const orderData = data.data;
    const isStopOrder = data.topic.includes("advancedOrders");

    // Determine order specifics for market or limit
    const getOrderSpecifics = (orderData) => {
        if (orderData.orderType === 'market') {
            return 'market';
        } else if (orderData.orderType === 'limit') {
            return 'limit';
        }
        return '';
    };

    // Determine if it's a take profit or stop loss for stop orders
    const getStopOrderType = (orderData) => {
        if (orderData.stop === 'up' && orderData.side === 'sell' || orderData.stop === 'down' && orderData.side === 'buy') {
            return 'take_profit';
        } else if (orderData.stop === 'down' && orderData.side === 'sell' || orderData.stop === 'up' && orderData.side === 'buy') {
            return 'stop_loss';
        }
        return 'unknown_stop_type';
    };

    // Mapping for standard trade orders
    const standardOrderActions = {
        'open': orderData.status === 'done' ? `filled_${getOrderSpecifics(orderData)}_order` : `new_${getOrderSpecifics(orderData)}_order`,
        'match': `matched_${getOrderSpecifics(orderData)}_order`,
        'filled': `filled_${getOrderSpecifics(orderData)}_order`,
        'canceled': `cancelled_${getOrderSpecifics(orderData)}_order`,
        'update': `updated_${getOrderSpecifics(orderData)}_order`
    };

    // Mapping for stop orders
    const stopOrderActions = {
        'open': `new_${getStopOrderType(orderData)}_order`,
        'triggered': `triggered_${getStopOrderType(orderData)}_order`,
        'cancel': `cancelled_${getStopOrderType(orderData)}_order`
    };

    if (isStopOrder) {
        return stopOrderActions[orderData.type] || 'unknown_stop_order';
    } else {
        return standardOrderActions[orderData.type] || 'unknown_order';
    }
}

module.exports = getAction;
