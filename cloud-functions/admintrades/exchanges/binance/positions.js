const { getPositions } = require("./request");
const { mapPositionToTrade } = require("../../utils/firestore");
const CustomError = require("../../utils/error");

/**
 * Fetches and maps active Binance positions to trades.
 * @async
 * @param {string} apiKey - Binance API key.
 * @param {string} apiSecret - Binance API secret.
 * @param {string} user_id - User ID.
 * @returns {Promise<Array>} An array of mapped trades.
 * @throws {CustomError} Throws a custom error if the operation fails.
 */
async function getBinancePositions(apiKey, apiSecret, user_id) {
  try {
    const positions = await getPositions(apiKey, apiSecret);
    const trades = positions
      .filter(({ positionAmt }) => positionAmt !== 0)
      .map(async (position) => {
        const {
          positionSide,
          marginType,
          unRealizedProfit,
          isolatedMargin,
          entryPrice,
          positionAmt,
          symbol,
          leverage,
        } = position;

        const side = positionSide === "LONG" ? "Buy" : "Sell";
        const margin_mode = marginType === "isolated" ? "isolated" : "cross";
        const unrealised_pnl = unRealizedProfit;
        const margin = isolatedMargin;
        const size = positionAmt;

        // Calculate unrealized profit and loss percentage
        // const unrealised_pnl_pct = String(
        //   (
        //     (parseFloat(unRealizedProfit) /
        //       (parseFloat(positionAmt) * parseFloat(entryPrice))) *
        //     100 *
        //     parseFloat(leverage)
        //   ).toFixed(2) * -1 // Multiply by -1 to flip the sign
        // );

        // Calculate unrealized profit and loss percentage
        let unrealised_pnl_pct = (
          (parseFloat(unRealizedProfit) /
            (parseFloat(positionAmt) * parseFloat(entryPrice))) *
          100 *
          parseFloat(leverage)
        ).toFixed(2);

        // Flip the sign for short positions
        if (positionSide === "SHORT") {
          unrealised_pnl_pct *= -1;
        }

        unrealised_pnl_pct = String(unrealised_pnl_pct);

        return await mapPositionToTrade(
          {
            ...position,
            side,
            margin_mode,
            unrealised_pnl,
            margin,
            entryPrice,
            realised_pnl: "0",
            size,
            unrealised_pnl_pct,
          },
          user_id,
          symbol,
          "binance",
          side
        );
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
