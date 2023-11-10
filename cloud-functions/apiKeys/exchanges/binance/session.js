const ExchangeSession = require("../exchangeSession");
const CustomError = require("../../utils/error");
const { getBinanceAPIPerms } = require("./apiPerms");

/**
 * Class representing a Binance exchange session.
 * @extends ExchangeSession
 */
class BinanceSession extends ExchangeSession {
  /**
   * Create a new BinanceSession.
   * @param {string} apiKey - User's API key for Binance.
   * @param {string} apiSecret - User's API secret for Binance.
   */
  constructor(apiKey, apiSecret) {
    super(apiKey, apiSecret);
  }

  /**
   * Get orders from Binance for a specific trader.
   * @returns {Promise<Array>} - Array of order objects.
   */
  async getAPIPerms() {
    try {
      return await getBinanceAPIPerms(this.apiKey, this.apiSecret);
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError({
        message: `Failed to fetch Binance API Perms: ${error.message}`,
        status: 500,
        source: "getAPIPerms",
      });
    }
  }
}

module.exports = BinanceSession;
