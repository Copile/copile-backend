const ExchangeSession = require("../exchangeSession");
const { getBingXOrders, getBingXOrderStatuses } = require("../scripts/orders");
const { tradeOrder } = require('../api/perpetual.js');
const { getBingXPositions } = require("../scripts/positions");
const { getBingXBalance } = require("../scripts/balance");
const CustomError = require("../../../utils/error");

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

  /**
   * Fetches orders for a given trader.
   * @param {string} traderId - The ID of the trader.
   * @return {Promise<Array>} - A promise that resolves to an array of orders.
   */
  async getOrders(traderId) {
    try {
      return await getBingXOrders(this.apiKey, this.apiSecret, traderId);
    } catch (e) {
      if (e instanceof CustomError) {
        throw e;
      }
      throw new CustomError({
        message: `Failed to fetch BingX orders: ${e.message}`,
        status: 500,
        source: "getOrders",
      });
    }
  }

  /**
   * Fetches positions for a given user.
   * @param {string} traderId - The ID of the trader.
   * @return {Promise<Array>} - A promise that resolves to an array of positions.
   */
  async getPositions(traderId) {
    try {
      return await getBingXPositions(this.apiKey, this.apiSecret, traderId);
    } catch (e) {
      if (e instanceof CustomError) {
        throw e;
      }
      throw new CustomError({
        message: `Failed to fetch BingX positions: ${e.message}`,
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
      return await getBingXBalance(this.apiKey, this.apiSecret);
    } catch (e) {
      if (e instanceof CustomError) {
        throw e;
      }
      throw new CustomError({
        message: `Failed to fetch BingX balance: ${e.message}`,
        status: 500,
        source: "getBalance",
      });
    }
  }

  /**
   * Fetches the statuses of orders.
   * @return {Promise<Array>} - A promise that resolves to an array of order statuses.
   */
  async getOrderStatuses(symbol) {
    try {
      return await getBingXOrderStatuses(this.apiKey, this.apiSecret, symbol);
    } catch (e) {
      if (e instanceof CustomError) {
        throw e;
      }
      throw new CustomError({
        message: `Failed to fetch BingX order statuses: ${e.message}`,
        status: 500,
        source: "getOrderStatuses",
      });
    }
  }
    /**
   * Fetches the statuses of orders.
   * @param {string} symbol
   * @param {string} type - order type
   * @param {string} positionSide - either LONG or SHORT
   * @param {string} price - order price
   * @param {string} stopPrice - needed for take-profits and stop-losses
   * @param {string} quantity - order quantity
   * @return {Promise<Array>} - A promise that resolves to an array of order statuses.
   */
  async tradeOrder(symbol, type, side, positionSide, price, StopPrice, quantity) {
      try {
        return await tradeOrder(this.apiKey, this.apiSecret, symbol, type, side, positionSide, price, StopPrice, quantity);
      } catch (e) {
        if (e instanceof CustomError) {
          throw e;
        }
        throw new CustomError({
          message: `Failed to send BingX trade: ${e.message}`,
          status: 500,
          source: "tradeOrder",
        });
    }
  }

}

module.exports = BingXSession;
