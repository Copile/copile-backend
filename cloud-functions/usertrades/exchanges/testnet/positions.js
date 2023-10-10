const { RestClientV5 } = require("bybit-api");
const CustomError = require("../../utils/error");
const { mapPositionToTrade } = require("../../utils/firestore");

/**
 * Retrieves active positions for a given trader ID from Firestore in a testnet environment.
 *
 * @async
 * @param {string} userId - The unique ID of the user.
 * @returns {Promise<Array<Object>>} An array of active trade data objects.
 * @throws {CustomError} Throws a custom error if api call fails.
 */
async function getTestnetPositions(apiKey, apiSecret, userId) {
  try {
    const client = new RestClientV5({
      key: apiKey,
      secret: apiSecret,
      // strict_param_validation: true,
      testnet: true,
    });

    const positionData = await client.getPositionInfo({
      category: "linear",
      settleCoin: "USDT",
    });


    if (!positionData.result.list.length) {
      return [];
    }

    const trades = positionData.result.list
      .filter((position) => position.size !== 0)
      .map(async (originalPosition) => {
        // Create a new position object, to only hold needed properties
        let position = {};

        // Transform and enrich the position data
        position.symbol = originalPosition.symbol; // Position Symbol (e.g., "BTCUSDT")
        position.side = originalPosition.side; // Position side (e.g., "Buy" or "Sell")
        position.margin_mode =
          originalPosition.tradeMode === 0 ? "Isolated" : "Cross"; // Margin mode (e.g., "Isolated" or "Cross")
        position.leverage = originalPosition.leverage; // Leverage (e.g., "10")
        position.quantity = originalPosition.size; // Position quantity (e.g., "0.001")
        position.margin = originalPosition.positionBalance; // Position margin (e.g., "15")
        position.entry_price = originalPosition.avgPrice; // Entry price (e.g., "25680")
        position.unrealised_pnl = originalPosition.unrealisedPnl; // Unrealised PnL (e.g., "2.45")
        position.unrealised_pnl_pct = String(
          (
            (parseFloat(originalPosition.unrealisedPnl) * 100) /
            parseFloat(originalPosition.positionBalance)
          ).toFixed(2)
        ); // Unrealised PnL percentage (e.g., "12.65%")
        position.realised_pnl = "0"; // Realised PnL (e.g., "-4.51")
        return await mapPositionToTrade(position, userId, "testnet");
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
