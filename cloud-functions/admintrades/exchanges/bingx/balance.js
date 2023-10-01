const { getBalance } = require("./request");
const CustomError = require("../../utils/error"); // Import the CustomError class from the correct path

/**
 * Fetches the available balance from BingX for a specific API key and secret.
 * 
 * @param {string} apiKey - User's API key for BingX.
 * @param {string} apiSecret - User's API secret for BingX.
 * 
 * @returns {Promise<number>} - Promise that resolves to the available margin balance as a number.
 * @throws {CustomError} - Will throw a CustomError if the request fails.
 */
async function getBingXBalance(apiKey, apiSecret) {
  try {
    const balance = await getBalance(apiKey, apiSecret);

    console.log('balance', balance);

    // Validate the structure of the response data
    if (!balance || !balance.data || !balance.data.data || !balance.data.data.balance) {
      throw new CustomError({ message: 'Unexpected response format from BingX', status: 502 });
    }

    return balance.data.data.balance.availableMargin;

  } catch (e) {
    // If it's already a custom error, throw it as-is
    if (e instanceof CustomError) {
      throw e;
    }
    // Otherwise, wrap it in a CustomError and specify the source
    throw new CustomError({ message: `Failed to get balance from BingX: ${e.message}`, source: 'getBingXBalance', status: 500 });
  }
}

module.exports = { getBingXBalance };
