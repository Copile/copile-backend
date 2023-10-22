const { getBalance } = require("./request");
const CustomError = require("../../utils/error");
const getAPIPerms = require("./request");

/**
 * Retrieves the API Key Permissions for a Binance account.
 * @async
 * @param {string} apiKey - The API key for Binance.
 * @param {string} apiSecret - The API secret for Binance.
 * @returns {Promise<string>} A string representing the api key perms.
 * @throws {CustomError} Throws a custom error if the operation fails.
 */
async function getBinanceAPIPerms(apiKey, apiSecret) {
  try {
    const response = await getAPIPerms(apiKey, apiSecret);
    return response;
  } catch (error) {
    // If it's already a custom error, throw it as-is
    if (error instanceof CustomError) {
      throw error;
    }
    throw new CustomError({
      message: `Failed to get Binance API Key permissions: ${error.message}`,
      status: 400,
      source: "getBinanceAPIPerms",
    });
  }
}

module.exports = { getBinanceAPIPerms };
