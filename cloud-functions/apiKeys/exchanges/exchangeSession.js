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
   * Fetch the balance for the session.
   * @async
   * @throws {CustomError} Throws a custom error if method not implemented by subclass.
   */
  async getAPIPerms() {
    throw new CustomError({
      message: "Method getAPIPerms must be implemented by subclass",
      status: 501,
      source: "getAPIPerms",
    });
  }
}

module.exports = ExchangeSession;
