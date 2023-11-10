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
  try {
    const response = await getAPIPerms(apiKey, apiSecret);
    const status = response.status;
    if(response.data){
      return response.data;
    }
    return response;
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }
    throw new CustomError({
      message: `Failed to get BingX API Key permissions: ${error.message}`,
      status: 400,
      source: "getBingXAPIPerms",
    });
  }
}

module.exports = { getBingXAPIPerms };
