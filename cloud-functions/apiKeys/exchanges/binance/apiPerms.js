const CustomError = require("../../utils/error");
const { getAPIPerms } = require("./request");

/**
 * Retrieves the API Key Permissions for a Binance account.
 * @async
 * @param {string} apiKey - The API key for Binance.
 * @param {string} apiSecret - The API secret for Binance.
 * @returns {Promise<string>} A string representing the api key perms.
 * @throws {CustomError} Throws a custom error if the operation fails.
 */
async function getBinanceAPIPerms(apiKey, apiSecret) {
  const apiPermsResponse = await getAPIPerms(apiKey, apiSecret);
  if(!apiPermsResponse || !apiPermsResponse.data || !apiPermsResponse.status === 200) {
    console.log(apiPermsResponse);
    return {
      success: false,
      data: apiPermsResponse,
    };
  }
  console.log(apiPermsResponse.data);
  return {
    success: true,
    data: apiPermsResponse.data,
  };
}

module.exports = { getBinanceAPIPerms };
