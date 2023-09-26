const { ContractClient } = require("bybit-api");
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
async function getTestnetPositions(apiKey, apiSecret, traderId) {
  try {
    console.log("apiKey", apiKey);
    console.log("apiSecret", apiSecret);
    console.log("traderId", traderId);

    const client = new ContractClient({
      key: apiKey,
      secret: apiSecret,
      // strict_param_validation: true,
      testnet: true,
    });

    // const positionData = await client.getPositions({
    //   settleCoin: "USDT",
    // });

    const positionData = await client.getPositions();

    if (!positionData.result.list) {
      return [];
    }

    console.log("positionData", positionData);
    console.log("positionData.result.list", positionData.result.list);

    const trades = positionData.result.list
      .filter((position) => position.size !== 0)
      .map(async (position) => {
        let margin = position.positionBalance;
        position.unrealised_pnl_pct = String(
          ((position.unrealisedPnl * 100) / margin).toFixed(2)
        );
        return await mapPositionToTrade(
          position,
          traderId,
          position.symbol,
          "bybit",
          position.side
        );
      });

    console.log("testnet positionData formatted", trades);
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
