const { getPositions } = require("./request");
const { mapPositionToTrade } = require("../../utils/firestore");
const CustomError = require("../../utils/error");

/**
 * Fetches BingX positions and maps them to trade objects.
 *
 * @param {string} apiKey The API key for BingX.
 * @param {string} apiSecret The API secret for BingX.
 * @param {string} traderId The trader ID.
 * @returns {Promise<Array<Object>>} An array of trade objects.
 * @throws {CustomError} Throws a CustomError if the operation fails.
 */
async function getBingXPositions(apiKey, apiSecret, traderId) {
  try {
    const positions = await getPositions(apiKey, apiSecret);
    const trades = positions
      .filter((position) => position.positionAmt !== "0")
      .map(async (originalPosition) => {
        // Create a new position object, to only hold needed properties
        let position = {};

        // Transform and enrich the position data
        position.symbol = originalPosition.symbol; // Position Symbol (e.g., "BTCUSDT")
        position.side =
          originalPosition.positionSide === "LONG" ? "Buy" : "Sell"; // Position side (e.g., "Buy" or "Sell")
        position.margin_mode =
          originalPosition.isolated === true ? "Isolated" : "Cross"; // Margin mode (e.g., "Isolated" or "Cross")
        position.leverage = String(originalPosition.leverage); // Leverage (e.g., "10")
        position.quantity = position.positionAmt; // Position quantity (e.g., "0.001")
        position.margin = originalPosition.initialMargin; // Initial margin (e.g., "15")
        position.entry_price = originalPosition.avgPrice; // Entry price (e.g., "25680")
        position.unrealised_pnl = originalPosition.unrealizedProfit; // Unrealised PnL (e.g., "2.45")
        position.unrealised_pnl_pct = String(
          (
            (parseFloat(originalPosition.unrealizedProfit) /
              (parseFloat(originalPosition.positionAmt) *
                parseFloat(originalPosition.avgPrice))) *
            100 *
            parseFloat(originalPosition.leverage)
          ).toFixed(2)
        ); // Unrealised PnL percentage (e.g., "12.65%")
        position.realised_pnl = originalPosition.realisedProfit; // Realised PnL (e.g., "-4.51")

        return await mapPositionToTrade(position, traderId, "bingx");
      });

    return await Promise.all(trades);
  } catch (e) {
    if (e instanceof CustomError) {
      throw e;
    }
    throw new CustomError({
      message: `An error occurred while retrieving trades from BingX: ${e.message}`,
      source: "getBingXPositions",
      status: 500,
    });
  }
}

module.exports = { getBingXPositions };
