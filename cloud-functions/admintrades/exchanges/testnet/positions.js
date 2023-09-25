const { ContractClient } = require('bybit-api');
const CustomError = require("../../utils/error");
const { mapPositionToTrade } = require("../../utils/firestore");

/**
 * Retrieves active positions for a given trader ID from Firestore in a testnet environment.
 *
 * @async
 * @param {string} traderId - The unique ID of the trader.
 * @returns {Promise<Array<Object>>} An array of active trade data objects.
 * @throws {CustomError} Throws a custom error if api call fails.
 */
async function getTestnetPositions(traderId) {
  try {
    const client = new ContractClient({
      key: apiKey,
      secret: apiSecret,
      strict_param_validation: true,
    });

    const positionData = await client.getPositions({
      settleCoin: 'USDT',
    });

    if (!positionData.result.list.length) {
      return [];
    }

    const trades = positionData.result.list
      .filter(position => position.size !== 0)
      .map(async position => {
        let margin = position.positionBalance;
        position.unrealised_pnl_pct = String(((position.unrealisedPnl * 100) / margin).toFixed(2));
        return await mapPositionToTrade(position, traderId, position.symbol, "bybit", position.side);
      });
    return await Promise.all(trades);
  } catch (e) {
    throw new CustomError({
      message: `Failed to fetch testnet positions: ${e.message}`,
      status: 500,
      source: "getTestnetPositions",
    });
  }
}

module.exports = { getTestnetPositions };
