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
   * Execute a bulkOrder for the session
   * @async
   * @throws {CustomError} Thorws a custom error if method not implemented by subclass.
   */
  async bulkOrder(payload) {
    throw new CustomError({
      message: "Method bulkOrder must be implemented by subclass",
      status: 501,
      source: "bulkOrder",
    });
  }
}

module.exports = ExchangeSession;
