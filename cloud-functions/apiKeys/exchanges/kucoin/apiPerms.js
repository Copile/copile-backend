const KuCoinFutures = require("kucoin-futures-node-sdk").default;
const CustomError = require("../../utils/error");

/**
 * Fetches account information from KuCoin.
 * @param {string} apiKey - The API key.
 * @param {string} apiSecret - The API secret.
 * @param {string} apiPassphrase - The API passphrase.
 * @returns {Object} An object containing success status, status code, and account data or error message.
 */
async function getKucoinAPIPerms(apiKey, apiSecret, apiPassphrase) {
  const futuresSDK = new KuCoinFutures({
    key: apiKey,
    secret: apiSecret,
    passphrase: apiPassphrase,
  });

  try {
    const accountInfoResponse = await futuresSDK.futuresAccount();
    console.log(accountInfoResponse);
    if (!accountInfoResponse || accountInfoResponse.status !== 200) {
      return {
        success: false,
        code: accountInfoResponse?.status || 500,
        message: "Failed to fetch account info.",
      };
    }

    return {
      success: true,
      code: accountInfoResponse.status,
      data: accountInfoResponse.data,
    };
  } catch (err) {
    const statusCode = err.status || 500;
    const message =
      statusCode === 401 ? "Invalid API-Key." : "An error occurred.";

    return {
      success: false,
      code: statusCode,
      message: message,
    };
  }
}

module.exports = {
  getKucoinAPIPerms,
};
