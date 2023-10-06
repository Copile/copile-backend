const kucoinAPI = require("kucoin-futures-node-api");
const CustomError = require("../../utils/error");

/**
 * Initialize KuCoin API client.
 * @param {string} apiKey - API key.
 * @param {string} apiSecret - API secret.
 * @param {string} apiPassphrase - API passphrase.
 * @returns {Object} - Initialized API client.
 */
const initKucoinApi = async (apiKey, apiSecret, apiPassphrase) => {
  const config = {
    apiKey,
    secretKey: apiSecret,
    passphrase: apiPassphrase,
    environment: "live",
  };
  const apiLive = await new kucoinAPI();
  apiLive.init(config);
  return apiLive;
};

/**
 * Fetch KuCoin balance.
 * @param {string} apiKey - API key.
 * @param {string} apiSecret - API secret.
 * @param {string} apiPassphrase - API passphrase.
 * @returns {string} - Available balance.
 */
async function getKucoinBalance(apiKey, apiSecret, apiPassphrase) {
  try {
    const apiLive =  await initKucoinApi(apiKey, apiSecret, apiPassphrase);
    const params = {
      currency: "USDT",
    };
    const balance = await apiLive.getAccountOverview(params);
    return String(balance.data.availableBalance);
  } catch (e) {
    // If it's already a custom error, throw it as-is
    if (e instanceof CustomError) {
      throw e;
    }
    throw new CustomError({
      message: `Failed to fetch KuCoin balance: ${e.message}`,
      status: 500,
      source: "getKucoinBalance",
    });
  }
}

module.exports = {
  getKucoinBalance,
};
