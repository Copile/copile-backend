const { getPositions } = require("./request");
const { mapPositionToTrade } = require("../../utils/firestore");
const CustomError = require("../../utils/error");

/**
 * Fetches and maps active Binance positions to trades.
 * @async
 * @param {string} apiKey - Binance API key.
 * @param {string} apiSecret - Binance API secret.
 * @param {string} traderId - Trader ID.
 * @returns {Promise<Array>} An array of mapped trades.
 * @throws {CustomError} Throws a custom error if the operation fails.
 */
async function getBinancePositions(apiKey, apiSecret, traderId) {
  try {
    const positions = await getPositions(apiKey, apiSecret);
    if (!positions || !positions.length) return [];
    const trades = positions
      .filter(({ positionAmt }) => parseFloat(positionAmt) !== 0)
      .map(async (originalPosition) => {
        // Create a new position object, to only hold needed properties
        let position = {};

        // Updating properties
        position.symbol = originalPosition.symbol; // Position Symbol (e.g., "BTCUSDT")
        position.side =
          originalPosition.positionSide === "LONG" ? "Buy" : "Sell"; // Position side (e.g., "Buy" or "Sell")
        position.margin_mode =
          originalPosition.marginType === "isolated" ? "isolated" : "cross"; // Margin mode (e.g., "Isolated" or "Cross")
        position.leverage = originalPosition.leverage; // Leverage (e.g., "10")
        position.quantity = originalPosition.positionAmt; // Position quantity (e.g., "0.001")
        position.margin = originalPosition.isolatedMargin; // Initial margin (e.g., "15")
        position.entry_price = originalPosition.entryPrice; // Entry price (e.g., "25680")
        position.unrealised_pnl = originalPosition.unRealizedProfit; // Unrealised PnL (e.g., "2.45")

        // Calculate unrealized profit and loss percentage
        let unrealised_pnl_pct = (
          (parseFloat(originalPosition.unRealizedProfit) /
            (parseFloat(originalPosition.positionAmt) *
              parseFloat(originalPosition.entryPrice))) *
          100 *
          parseFloat(originalPosition.leverage)
        ).toFixed(2);

        // Flip the sign for short positions
        if (originalPosition.positionSide === "SHORT") {
          unrealised_pnl_pct *= -1;
        }

        position.unrealised_pnl_pct = String(unrealised_pnl_pct); // Unrealised PnL percentage (e.g., "12.65%")
        position.realised_pnl = "0"; // Binance does not provide realised PnL
        position.liq_price = originalPosition.liquidationPrice; // Liquidation price (e.g., "25680")

        // Pass the whole modified position object to mapPositionToTrade
        return await mapPositionToTrade(position, traderId, "binance");
      });

    return await Promise.all(trades);
  } catch (error) {
    // If it's already a custom error, throw it as-is
    if (error instanceof CustomError) {
      throw error;
    }
    throw new CustomError({
      message: `Error fetching Binance positions: ${error.message}`,
      status: 400,
      source: "getBinancePositions",
    });
  }
}

module.exports = { getBinancePositions };
