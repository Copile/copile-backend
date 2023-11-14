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
  const futuresSDK = new KuCoinFutures({
    key: apiKey, // KC-API-KEY
    secret: apiSecret, // API-Secret
    passphrase: apiPassphrase, // KC-API-PASSPHRASE
  });
  try {
    const accountInfoResponse = await futuresSDK.futuresAccount();
    if (
      !accountInfoResponse ||
      !accountInfoResponse.data ||
      !accountInfoResponse.status === 200
    ) {
      console.log(accountInfoResponse);
      return {
        success: false,
        data: accountInfoResponse,
      };
    }
    return {
      success: true,
      data: accountInfoResponse.data,
    };
  } catch (err) {
    console.log(err);
    return {
      success: false,
      data: err,
    };
  }
}

module.exports = {
  getKucoinAPIPerms,
};
