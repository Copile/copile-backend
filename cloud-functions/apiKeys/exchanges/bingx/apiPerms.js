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
async function getBingXAPIPerms(apiKey, apiSecret) {
  const response = await getAPIPerms(apiKey, apiSecret);
  if (!response || !response.data || !response.data.code === 0) {
    console.log(response);
    return {
      success: false,
      data: response,
    };
  }
  console.log(response.data);
  return {
    success: true,
    data: response.data.data,
  };
}

module.exports = { getBingXAPIPerms };
