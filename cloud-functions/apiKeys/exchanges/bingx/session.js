const ExchangeSession = require("../exchangeSession");
const { getBingXAPIPerms } = require("./apiPerms");

const CustomError = require("../../utils/error");

/**
 * Represents a BingX exchange session.
 * @extends ExchangeSession
 */
class BingXSession extends ExchangeSession {
  /**
   * Creates a BingXSession instance.
   * @param {string} apiKey - API key for the BingX session.
   * @param {string} apiSecret - API secret for the BingX session.
   */
  constructor(apiKey, apiSecret) {
    super(apiKey, apiSecret);
  }

  async getAPIPerms() {
    try {
      return await getBingXAPIPerms(this.apiKey, this.apiSecret);
    } catch (error) {
      throw new CustomError({
        message: `Failed to fetch BingX API Perms: ${error.message}`,
        status: 500,
        source: "getAPIPerms",
      });
    }
  }
}

module.exports = BingXSession;
