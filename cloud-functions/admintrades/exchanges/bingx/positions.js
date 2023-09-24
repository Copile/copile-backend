const { getPositions } = require('./request');
const { mapPositionToTrade } = require('../../utils/firestore');
const CustomError = require('../../utils/error');

/**
 * Fetches BingX positions and maps them to trade objects.
 * 
 * @param {string} apiKey The API key for BingX.
 * @param {string} apiSecret The API secret for BingX.
 * @param {string} userId The user ID.
 * @returns {Promise<Array<Object>>} An array of trade objects.
 * @throws {CustomError} Throws a CustomError if the operation fails.
 */
async function getBingXPositions(apiKey, apiSecret, userId) {
  try {
    const positions = await getPositions(apiKey, apiSecret);
    const trades = positions
      .filter((position) => position.positionAmt !== 0)
      .map(async (position) => {
        // Transform and enrich the position data
        position.side = position.positionSide === 'LONG' ? 'Buy' : 'Sell';
        position.margin_mode = position.isolated === true ? 'isolated' : 'cross';
        position.unrealised_pnl = position.unrealizedProfit;
        position.positionBalance = parseFloat(position.positionAmt) * parseFloat(position.avgPrice);
        position.margin = String(
          parseFloat(position.initialMargin) - parseFloat(position.unrealizedProfit)
        );
        position.entryPrice = position.avgPrice;
        position.realised_pnl = position.realisedProfit;
        position.size = position.positionAmt;
        position.unrealised_pnl_pct = String(
          (
            (parseFloat(position.unrealizedProfit) /
              (parseFloat(position.positionAmt) * parseFloat(position.avgPrice))) *
            100 *
            parseFloat(position.leverage)
          ).toFixed(2)
        );

        return await mapPositionToTrade(
          position,
          userId,
          position.symbol,
          'bingx',
          position.side
        );
      });

    return await Promise.all(trades);
  } catch (e) {
    if (e instanceof CustomError) {
      throw e;
    }
    throw new CustomError({
      message: `An error occurred while retrieving trades from BingX: ${e.message}`,
      source: 'getBingXPositions',
      status: 500
    });
  }
}

module.exports = { getBingXPositions };
