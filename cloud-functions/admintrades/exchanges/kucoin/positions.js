const kucoinAPI = require("kucoin-futures-node-api");
const { mapPositionToTrade } = require("../../utils/firestore");

async function getKucoinPositions(apiKey, apiSecret, apiPassphrase, user_id) {
  try {
    const config = {
      apiKey: apiKey,
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
          position.side = position.currentQty < 0 ? "Sell" : "Buy";
          position.margin_mode =
            position.crossMode === true ? "cross" : "isolated";
          if (position.currentQty < 0 && position.currentCost < 0) {
            position.currentQty *= -1;
            position.currentCost *= -1;
          }
          position.leverage = position.realLeverage;
          position.unrealised_pnl = position.unrealisedPnl;
          position.margin = position.maintMargin;
          position.unrealised_pnl_pct = String(
            (
              parseFloat(position.unrealisedPnlPcnt) *
              100 *
              parseFloat(position.realLeverage)
            ).toFixed(2)
          );
          position.entryPrice = position.avgEntryPrice;
          position.realised_pnl = position.realisedPnl;
          position.size = position.currentQty;

          return await mapPositionToTrade(
            position,
            user_id,
            position.symbol,
            "kucoin",
            position.side
          );
        });

      return await Promise.all(trades);
    } else {
      return [];
    }
  } catch (e) {
    console.error(
      `An error occurred while retrieving trades from KuCoin. Error message: ${e}`
    );
    return [];
  }
}

module.exports = { getKucoinPositions };