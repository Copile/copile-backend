const CustomError = require('../../../utils/error.js');

async function getTpsStatus(session, symbol, tpSlOrders) {
    try {
        const fetchOrders = await session.currentOrders(symbol);
        const openOrders = fetchOrders["orders"];

        let tpsData = [];
        const activeStatus = ["NEW", "PARTIALLY_FILLED"];

        for (let tpOrder of tpSlOrders) {
            if ("tp_number" in tpOrder) {
                const tpOrderId = tpOrder["orderID"];
                const matchingOpenOrders = openOrders.filter(openOrder => String(openOrder["orderId"]) === tpOrderId);
                tpOrder["tp_status"] = matchingOpenOrders.length > 0 && activeStatus.includes(matchingOpenOrders[0]["status"]) ? "active" : "filled";
                tpsData.push(tpOrder);
            }
        }
        return tpsData;
    } catch(error) {
        throw new CustomError({
            message: `Error getting status of tps in scripts: ${error.message}`,
            status: 500,
            source: 'getTpsStatus',
        });
    }
}

module.exports = {getTpsStatus};
