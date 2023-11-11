const CustomError = require("../firestore/error.js");
const { getOrder } = require('./request.js');

/**
 * Class representing a Binance exchange session.
 * @extends ExchangeSession
 */
class BinanceSession {
  /**
   * Create a new BinanceSession instance.
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
  async getOrderQuantity(symbol, orderId) {
    try {
      const order = await getOrder(symbol, orderId, this.apiKey, this.apiSecret);
      return order.quantity;
    } catch(error) {
      throw new CustomError({
        message: `Method getOrder in BinanceSession ${error.message}`,
        status: 501,
        source: "getOrderQuantity",
      });
    }
  }
}

module.exports = BinanceSession;
