const ExchangeSession = require("../exchangeSession");
const CustomError = require("../../utils/error");
const { getTestnetBalance } = require("./balance");
const { getTestnetPositions } = require("./positions");

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
   * Fetch positions for a given trader ID.
   * @async
   * @param {string} userId - The unique ID of the trader.
   * @returns {Promise<Array<Object>>} An array of position data objects.
   * @throws {CustomError} Throws a custom error if operation fails.
   */
  async getPositions(userId) {
    try {
      return await getTestnetPositions(this.apiKey, this.apiSecret, userId);
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError({
        message: `Failed to fetch testnet positions: ${error.message}`,
        status: 500,
        source: "getPositions",
      });
    }
  }

  /**
   * Fetch the balance for a given trader ID.
   * @async
   * @returns {Promise<number>} The trader's balance.
   * @throws {CustomError} Throws a custom error if operation fails.
   */
  async getBalance() {
    try {
      return await getTestnetBalance(this.apiKey, this.apiSecret);
    } catch (e) {
      if (e instanceof CustomError) {
        throw e;
      }
      throw new CustomError({
        message: `Failed to fetch testnet balance: ${e.message}`,
        status: 500,
        source: "getBalance",
      });
    }
  }
}

module.exports = BybitSession;
