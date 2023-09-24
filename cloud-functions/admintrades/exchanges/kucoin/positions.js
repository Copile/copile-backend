const kucoinAPI = require("kucoin-futures-node-api");
const { mapPositionToTrade } = require("../../utils/firestore");
const CustomError = require("../../utils/error");

/**
 * Transforms the position object according to specified rules.
 * @param {Object} position - The position object from KuCoin API.
 * @returns {Object} - The transformed position object.
 */
const transformPosition = (position) => {
  return {
    ...position,
    side: position.currentQty < 0 ? "Sell" : "Buy",
    marginMode: position.crossMode ? "cross" : "isolated",
    currentQty: Math.abs(position.currentQty),
    currentCost: Math.abs(position.currentCost),
    leverage: position.realLeverage,
    unrealisedPnl: position.unrealisedPnl,
    margin: position.maintMargin,
    unrealisedPnlPct: (
      parseFloat(position.unrealisedPnlPcnt) *
      100 *
      parseFloat(position.realLeverage)
    ).toFixed(2),
    entryPrice: position.avgEntryPrice,
    realisedPnl: position.realisedPnl,
    size: Math.abs(position.currentQty),
  };
};

/**
 * Gets KuCoin positions.
 * @param {string} apiKey - The API key.
 * @param {string} apiSecret - The API secret.
 * @param {string} apiPassphrase - The API passphrase.
 * @param {string} userId - The user ID.
 * @returns {Promise<Array>} - A promise that resolves to an array of positions.
 */
async function getKucoinPositions(apiKey, apiSecret, apiPassphrase, userId) {
  try {
    const config = {
      apiKey,
      secretKey: apiSecret,
      passphrase: apiPassphrase,
      environment: "live",
    };

    const apiLive = new kucoinAPI();
    apiLive.init(config);

    let positions = await apiLive.getAllPositions();
    positions = positions.data;

    if (positions !== null) {
      const trades = positions
        .filter((position) => position.size !== 0)
        .map(async (position) => {
          const transformedPosition = transformPosition(position);
          return await mapPositionToTrade(
            transformedPosition,
            userId,
            transformedPosition.symbol,
            "kucoin",
            transformedPosition.side
          );
        });

      return await Promise.all(trades);
    } else {
      return [];
    }
  } catch (e) {
    // If it's already a custom error, throw it as-is
    if (e instanceof CustomError) {
      throw e;
    }
    // Otherwise, wrap it in a CustomError and specify the source
    throw new CustomError({
      message: `Failed to fetch KuCoin positions: ${e.message}`,
      status: 500,
      source: "getKucoinPositions",
    });
  }
}

module.exports = { getKucoinPositions };
