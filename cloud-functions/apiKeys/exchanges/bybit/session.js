const ExchangeSession = require("../exchangeSession");
const CustomError = require("../../utils/error");
const { getBybitAPIPerms } = require("./apiPerms");

/**
 * Represents an exchange session for the testnet.
 * @extends ExchangeSession
 */
class BybitSession extends ExchangeSession {
  /**
   * Creates a Testnet Session instance.
   * @param {string} apiKey - API key for the Testnet session.
   * @param {string} apiSecret - API secret for the Testnet session.
   */
  constructor(apiKey, apiSecret) {
    super(apiKey, apiSecret);
  }

  /**
   * Fetch the balance for a given trader ID.
   * @async
   * @returns {Promise<number>} The trader's balance.
   * @throws {CustomError} Throws a custom error if operation fails.
   */
  async getAPIPerms() {
    try {
      return await getBybitAPIPerms(this.apiKey, this.apiSecret);
    } catch (e) {
      if (e instanceof CustomError) {
        throw e;
      }
      throw new CustomError({
        message: `Failed to fetch Bybit API Perms: ${e.message}`,
        status: 500,
        source: "getAPIPerms",
      });
    }
  }
}

module.exports = BybitSession;
