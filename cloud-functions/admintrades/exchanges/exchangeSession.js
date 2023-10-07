const CustomError = require("../utils/error"); // Assuming CustomError is in this path

/**
 * Base class for implementing different exchange sessions.
 */
class ExchangeSession {
  /**
   * Create a new ExchangeSession instance.
   * @param {string} apiKey - The API key for the session.
   * @param {string} apiSecret - The API secret for the session.
   */
  constructor(apiKey, apiSecret) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  /**
   * Fetch orders for a given trader ID.
   * @async
   * @param {string} traderId - The unique ID of the trader.
   * @throws {CustomError} Throws a custom error if method not implemented by subclass.
   */
  async getOrders(traderId) {
    throw new CustomError({
      message: "Method getOrders must be implemented by subclass",
      status: 501,
      source: "getOrders",
    });
  }

  /**
   * Fetch positions for a given user ID.
   * @async
   * @param {string} traderId - The unique ID of the trader.
   * @throws {CustomError} Throws a custom error if method not implemented by subclass.
   */
  async getPositions(traderId) {
    throw new CustomError({
      message: "Method getPositions must be implemented by subclass",
      status: 501,
      source: "getPositions",
    });
  }

  /**
   * Fetch the balance for the session.
   * @async
   * @throws {CustomError} Throws a custom error if method not implemented by subclass.
   */
  async getBalance() {
    throw new CustomError({
      message: "Method getBalance must be implemented by subclass",
      status: 501,
      source: "getBalance",
    });
  }

  /**
   * Fetch order statuses for the session.
   * @async
   * @throws {CustomError} Throws a custom error if method not implemented by subclass.
   */
  async getOrderStatuses(symbol) {
    throw new CustomError({
      message: "Method getOrderStatuses must be implemented by subclass",
      status: 501,
      source: "getOrderStatuses",
    });
  }
}

module.exports = ExchangeSession;
