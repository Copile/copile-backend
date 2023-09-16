const kucoinAPI = require("kucoin-futures-node-api");

async function getKucoinBalance(apiKey, apiSecret, apiPassphrase) {
  try {
    const config = {
      apiKey: apiKey,
      secretKey: apiSecret,
      passphrase: apiPassphrase,
      environment: "live",
    };
    const apiLive = new kucoinAPI();
    apiLive.init(config);

    params = {
      currency: "USDT",
    };

    const balance = await apiLive.getAccountOverview(params);
    return String(balance.data.availableBalance);
  } catch (e) {
    console.log("Error in getKucoinBalance: ", e);
    return [];
  }
}

module.exports = { getKucoinBalance };