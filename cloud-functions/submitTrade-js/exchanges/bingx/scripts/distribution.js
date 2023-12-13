const rearrangeTps = require('../../../utils/shuffle.js');

async function calculateTpAmounts(takeProfits, quantity, precision) {
    try {
        const tpsPercentage = takeProfits.map(tpData => tpData.tp_percentage);

        const tpsAmount = tpsPercentage.map(tp => quantity * tp);
        const tpAmounts = await rearrangeTps(quantity, precision.quantityPrecision, tpsAmount, precision.minQty);

        const newTakeProfits = takeProfits.reduce((acc, tpData, index) => {
            if (tpAmounts[index] > 0) {
                const tpId = tpData.document_id || tpData.tp_id;
                const tpNumber = tpData.tp_number;
                const tpValue = tpData.tp_value;
                const tpPercentage = Math.round((tpAmounts[index] / tpAmounts.reduce((a, b) => a + b, 0)) * 100) / 100;
                const tpAmount = tpAmounts[index];

                acc.push({
                    tp_id: tpId,
                    tp_number: tpNumber,
                    tp_value: tpValue,
                    tp_percentage: tpPercentage,
                    tp_amount: tpAmount
                });
            }
            return acc;
        }, []);

        return newTakeProfits;
    } catch (error) {
        throw new CustomError({
            message: `An error occurred while calculating take-profits in Bingx: ${e.message}`,
            source: "calculateTpAmounts",
            status: 500,
          });
    }
}

module.exports = calculateTpAmounts;
