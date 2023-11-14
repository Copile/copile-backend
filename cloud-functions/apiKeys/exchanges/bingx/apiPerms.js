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
  console.log(response.data.code);
  if (!response || !response.data || !response.data.code === 0) {
    return {
      success: false,
      code: response.data.code,
      data: response.msg,
    };
  }
  return {
    success: true,
    code: 200,
    data: response.data,
  };
}

module.exports = { getBingXAPIPerms };
