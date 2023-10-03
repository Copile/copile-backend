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
    symbol: position.symbol, // Position Symbol (e.g., "BTCUSDT")
    side: position.currentQty < 0 ? "Sell" : "Buy", // Position side (e.g., "Buy" or "Sell")
    margin_mode: position.crossMode ? "Cross" : "Isolated", // Margin mode (e.g., "Isolated" or "Cross")
    leverage: String(position.realLeverage), // Leverage (e.g., "10")
    quantity: String(Math.abs(position.currentQty)), // Position quantity (e.g., "0.001")
    margin: String(position.maintMargin), // Initial margin (e.g., "15")
    entry_price: position.avgEntryPrice, // Entry price (e.g., "25680")
    unrealised_pnl: position.unrealisedPnl, // Unrealised PnL (e.g., "2.45")
    unrealised_pnl_pct: (
      parseFloat(position.unrealisedPnlPcnt) *
      100 *
      parseFloat(position.realLeverage)
    ).toFixed(2), // Unrealised PnL percentage (e.g., "12.65%")
    realised_pnl: position.realisedPnl, // Realised PnL (e.g., "-4.51")
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

    const apiLive = await new kucoinAPI();
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
            "kucoin"
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
