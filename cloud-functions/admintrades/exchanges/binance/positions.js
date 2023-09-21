const { getPositions } = require("./request");
const { mapPositionToTrade } = require("../../utils/firestore");

async function getBinancePositions(apiKey, apiSecret, user_id) {
  try {
    const positions = await getPositions(apiKey, apiSecret);
    const trades = positions
      .filter((position) => position.positionAmt !== 0)
      .map(async (position) => {
        position.side = position.positionSide === "LONG" ? "Buy" : "Sell";
        position.margin_mode =
          position.marginType === "isolated" ? "isolated" : "cross";
        position.unrealised_pnl = position.unRealizedProfit;
        position.margin = position.isolatedMargin;
        position.entryPrice = position.entryPrice;
        position.realised_pnl = "0"; // Binance does not provide realised PnL via API
        position.size = position.positionAmt;
        // position.unrealised_pnl_pct = String(
        //   (
        //     (parseFloat(position.unRealizedProfit) /
        //       (parseFloat(position.positionAmt) *
        //         parseFloat(position.entryPrice))) *
        //     100 *
        //     parseFloat(position.leverage)
        //   ).toFixed(2)
        // );
        position.unrealised_pnl_pct = String(
          (
            (parseFloat(position.unRealizedProfit) /
              (parseFloat(position.positionAmt) *
                parseFloat(position.entryPrice))) *
            100 *
            parseFloat(position.leverage)
          ).toFixed(2) * -1 // Multiply by -1 to flip the sign
        );

        return await mapPositionToTrade(
          position,
          user_id,
          position.symbol,
          "binance",
          position.side
        );
      });

    return await Promise.all(trades);
  } catch (e) {
    console.error(
      `An error occurred while retrieving trades from Binance. Error message: ${e}`
    );
    return [];
  }
}

module.exports = { getBinancePositions };
