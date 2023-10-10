const ExchangeSession = require("../exchangeSession");
const { getBinanceOrders, getBinanceOrderStatuses } = require("./orders");
const { getBinancePositions } = require("./positions");
const { getBinanceBalance } = require("./balance");
const CustomError = require("../../utils/error");

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
   * @param {string} userId - Users's unique ID.
   * @returns {Promise<Array>} - Array of order objects.
   */
  async getOrders(userId) {
    try {
      return await getBinanceOrders(this.apiKey, this.apiSecret, userId);
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError({
        message: `Failed to fetch Binance orders: ${error.message}`,
        status: 500,
        source: "getOrders",
      });
    }
  }

  /**
   * Get positions from Binance for a specific user.
   * @param {string} userId - User's unique ID.
   * @returns {Promise<Array>} - Array of position objects.
   */
  async getPositions(userId) {
    try {
      return await getBinancePositions(this.apiKey, this.apiSecret, userId);
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError({
        message: `Failed to fetch Binance positions: ${error.message}`,
        status: 500,
        source: "getPositions",
      });
    }
  }

  /**
   * Get balance information from Binance.
   * @returns {Promise<Array>} - Array containing balance information.
   */
  async getBalance() {
    try {
      return await getBinanceBalance(this.apiKey, this.apiSecret);
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError({
        message: `Failed to fetch Binance balance: ${error.message}`,
        status: 500,
        source: "getBalance",
      });
    }
  }

  /**
   * Get the statuses of various orders.
   * @returns {Promise<Array>} - Array containing order statuses.
   */
  async getOrderStatuses(symbol) {
    try {
      return await getBinanceOrderStatuses(this.apiKey, this.apiSecret, symbol);
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError({
        message: `Failed to fetch Binance order statuses: ${error.message}`,
        status: 500,
        source: "getOrderStatuses",
      });
    }
  }
}

module.exports = BinanceSession;
