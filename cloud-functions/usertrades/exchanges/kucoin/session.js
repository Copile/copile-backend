const ExchangeSession = require("../exchangeSession");
const { getKucoinOrders, getKucoinOrderStatuses } = require("./orders");
const { getKucoinPositions } = require("./positions");
const { getKucoinBalance } = require("./balance");
const CustomError = require("../../utils/error");

/**
 * Represents a KuCoin exchange session.
 * @extends ExchangeSession
 */
class KuCoinSession extends ExchangeSession {
  /**
   * Creates a KuCoinSession instance.
   * @param {string} apiKey - API key for the KuCoin session.
   * @param {string} apiSecret - API secret for the KuCoin session.
   * @param {string} apiPassphrase - API passphrase for the KuCoin session.
   */
  constructor(apiKey, apiSecret, apiPassphrase) {
    super(apiKey, apiSecret);
    this.apiPassphrase = apiPassphrase;
  }

  /**
   * Fetches orders for a given trader.
   * @param {string} userId - The ID of the user.
   * @return {Promise<Array>} - A promise that resolves to an array of orders.
   */
  async getOrders(userId) {
    try {
      return await getKucoinOrders(
        this.apiKey,
        this.apiSecret,
        this.apiPassphrase,
        userId
      );
    } catch (e) {
      if (e instanceof CustomError) {
        throw e;
      }
      throw new CustomError({
        message: `Failed to fetch KuCoin orders: ${e.message}`,
        status: 500,
        source: "getOrders",
      });
    }
  }

  /**
   * Fetches positions for a given user.
   * @param {string} userId - The ID of the user.
   * @return {Promise<Array>} - A promise that resolves to an array of positions.
   */
  async getPositions(userId) {
    try {
      return await getKucoinPositions(
        this.apiKey,
        this.apiSecret,
        this.apiPassphrase,
        userId
      );
    } catch (e) {
      if (e instanceof CustomError) {
        throw e;
      }
      throw new CustomError({
        message: `Failed to fetch KuCoin positions: ${e.message}`,
        status: 500,
        source: "getPositions",
      });
    }
  }

  /**
   * Fetches the account balance.
   * @return {Promise<Object>} - A promise that resolves to an object containing the balance.
   */
  async getBalance() {
    try {
      return await getKucoinBalance(
        this.apiKey,
        this.apiSecret,
        this.apiPassphrase
      );
    } catch (e) {
      if (e instanceof CustomError) {
        throw e;
      }
      throw new CustomError({
        message: `Failed to fetch KuCoin balance: ${e.message}`,
        status: 500,
        source: "getBalance",
      });
    }
  }

  /**
   * Fetches the statuses of orders.
   * @return {Promise<Array>} - A promise that resolves to an array of order statuses.
   */
  async getOrderStatuses() {
    try {
      return await getKucoinOrderStatuses(
        this.apiKey,
        this.apiSecret,
        this.apiPassphrase
      );
    } catch (e) {
      if (e instanceof CustomError) {
        throw e;
      }
      throw new CustomError({
        message: `Failed to fetch KuCoin order statuses: ${e.message}`,
        status: 500,
        source: "getOrderStatuses",
      });
    }
  }
}

module.exports = KuCoinSession;
