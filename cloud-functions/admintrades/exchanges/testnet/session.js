const ExchangeSession = require("../exchangeSession");
const { getTestnetPositions } = require("./positions");
const CustomError = require('../../utils/error');

/**
 * Represents an exchange session for the testnet.
 * @extends ExchangeSession
 */
class TestnetSession extends ExchangeSession {
  constructor() {
    super();
  }

  /**
   * Fetch orders for a given trader ID.
   * @async
   * @param {string} traderId - The unique ID of the trader.
   * @returns {Promise<Array<Object>>} An array of order data objects.
   * @throws {CustomError} Throws a custom error if operation fails.
   */
  async getOrders(traderId) {
    // Implement the logic here, throw a CustomError if it fails
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
      return await getTestnetPositions(traderId);
    } catch (e) {
      if (e instanceof CustomError) {
        throw e;
      }
      throw new CustomError({
        message: `Failed to fetch testnet positions: ${e.message}`,
        status: 500,
        source: 'getPositions',
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
    // Implement the logic here, throw a CustomError if it fails
  }

  /**
   * Fetch order statuses for a given trader ID.
   * @async
   * @returns {Promise<Array<Object>>} An array of order status objects.
   * @throws {CustomError} Throws a custom error if operation fails.
   */
  async getOrderStatuses() {
    // Implement the logic here, throw a CustomError if it fails
  }
}

module.exports = TestnetSession;
