const ExchangeSession = require("../exchangeSession");
const CustomError = require("../../utils/error");
const { getTestnetPositions } = require("./positions");
const { getTestnetOrders, getTestnetOrderStatuses } = require("./orders");
const { getTestnetBalance } = require("./balance");

/**
 * Represents an exchange session for the testnet.
 * @extends ExchangeSession
 */
class TestnetSession extends ExchangeSession {
  /**
   * Creates a Testnet Session instance.
   * @param {string} apiKey - API key for the Testnet session.
   * @param {string} apiSecret - API secret for the Testnet session.
   */
  constructor(apiKey, apiSecret) {
    super(apiKey, apiSecret);
  }

  /**
   * Fetch orders for a given trader ID.
   * @async
   * @param {string} traderId - The unique ID of the trader.
   * @returns {Promise<Array<Object>>} An array of order data objects.
   * @throws {CustomError} Throws a custom error if operation fails.
   */
  async getOrders(traderId) {
    try {
      return await getTestnetOrders(this.apiKey, this.apiSecret, traderId);
    } catch (e) {
      if (e instanceof CustomError) {
        throw e;
      }
      throw new CustomError({
        message: `Failed to fetch testnet orders: ${e.message}`,
        status: 500,
        source: "getOrders",
      });
    }
  }

  /**
   * Fetch positions for a given trader ID.
   * @async
   * @param {string} traderId - The unique ID of the trader.
   * @returns {Promise<Array<Object>>} An array of position data objects.
   * @throws {CustomError} Throws a custom error if operation fails.
   */
  async getPositions(traderId) {
    try {
      return await getTestnetPositions(this.apiKey, this.apiSecret, traderId);
    } catch (e) {
      if (e instanceof CustomError) {
        throw e;
      }
      throw new CustomError({
        message: `Failed to fetch testnet positions: ${e.message}`,
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

  /**
   * Fetch order statuses for a given trader ID.
   * @async
   * @returns {Promise<Array<Object>>} An array of order status objects.
   * @throws {CustomError} Throws a custom error if operation fails.
   */
  async getOrderStatuses(symbol) {
    try {
      return await getTestnetOrderStatuses(this.apiKey, this.apiSecret, symbol);
    } catch (e) {
      if (e instanceof CustomError) {
        throw e;
      }
      throw new CustomError({
        message: `Failed to fetch testnet order statuses: ${e.message}`,
        status: 500,
        source: "getOrderStatuses",
      });
    }
  }
}

module.exports = TestnetSession;
