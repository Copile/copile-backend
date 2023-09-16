const { getPositions } = require("./request");
const { mapPositionToTrade } = require("../../utils/utils");

async function getBingXPositions(apiKey, apiSecret, user_id) {
    try {
      const positions = await getPositions(apiKey, apiSecret);
      const trades = positions
        .filter((position) => position.positionAmt !== 0)
        .map(async (position) => {
          position.side = position.positionSide === "LONG" ? "Buy" : "Sell";
          position.margin_mode =
            position.isolated === true ? "isolated" : "cross";
          position.unrealised_pnl = position.unrealizedProfit;
          position.positionBalance =
            parseFloat(position.positionAmt) * parseFloat(position.avgPrice);
          position.margin = String(
            parseFloat(position.initialMargin) -
              parseFloat(position.unrealizedProfit)
          );
          position.entryPrice = position.avgPrice;
          position.realised_pnl = position.realisedProfit;
          position.size = position.positionAmt;
          position.unrealised_pnl_pct = String(
            (
              (parseFloat(position.unrealizedProfit) /
                (parseFloat(position.positionAmt) *
                  parseFloat(position.avgPrice))) *
              100 *
              parseFloat(position.leverage)
            ).toFixed(2)
          );
  
          return await mapPositionToTrade(
            position,
            user_id,
            position.symbol,
            "bingx",
            position.side
          );
        });
  
      return await Promise.all(trades);
    } catch (e) {
      console.error(
        `An error occurred while retrieving trades from BingX. Error message: ${e}`
      );
      return [];
    }
  }

module.exports = { getBingXPositions };