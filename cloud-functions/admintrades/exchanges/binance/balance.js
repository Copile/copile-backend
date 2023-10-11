const { getBalance } = require("./request");
const CustomError = require("../../utils/error");

/**
 * Retrieves the available USDT balance for a Binance account.
 * @async
 * @param {string} apiKey - The API key for Binance.
 * @param {string} apiSecret - The API secret for Binance.
 * @returns {Promise<string>} A string representing the available USDT balance or "0" if USDT is not found.
 * @throws {CustomError} Throws a custom error if the operation fails.
 */
async function getBinanceBalance(apiKey, apiSecret) {
  try {
    const usdtBalance = await getBalance(apiKey, apiSecret);
    return usdtBalance ? String(usdtBalance.availableBalance) : "0";
  } catch (error) {
    // If it's already a custom error, throw it as-is
    if (error instanceof CustomError) {
      throw error;
    }
    throw new CustomError({
      message: `Failed to get Binance balance: ${error.message}`,
      status: 400,
      source: "getBinanceBalance",
    });
  }
}

module.exports = { getBinanceBalance };
