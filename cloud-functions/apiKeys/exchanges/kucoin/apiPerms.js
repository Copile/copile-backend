const KuCoinFutures = require("kucoin-futures-node-sdk").default;
const CustomError = require("../../utils/error");

/**
 * Fetch KuCoin balance.
 * @param {string} apiKey - API key.
 * @param {string} apiSecret - API secret.
 * @param {string} apiPassphrase - API passphrase.
 * @returns {string} - Available balance.
 */
async function getKucoinAPIPerms(apiKey, apiSecret, apiPassphrase) {
  try {
    const futuresSDK = new KuCoinFutures({
      key: apiKey, // KC-API-KEY
      secret: apiSecret, // API-Secret
      passphrase: apiPassphrase, // KC-API-PASSPHRASE
    });
    const accountInfo = await futuresSDK.futuresAccount();
    if (!accountInfo || !accountInfo.data || !accountInfo.status === 200) {
      throw new CustomError({
        message: "Failed to fetch KuCoin API Permissions",
        status: 500,
        source: "getKucoinAPIPerms",
      });
    }
    return accountInfo.data;
  } catch (e) {
    // If it's already a custom error, throw it as-is
    if (e instanceof CustomError) {
      throw e;
    }
    throw new CustomError({
      message: `Failed to fetch KuCoin API Permissions: ${e.message}`,
      status: 500,
      source: "getKucoinBalance",
    });
  }
}

module.exports = {
  getKucoinAPIPerms,
};
