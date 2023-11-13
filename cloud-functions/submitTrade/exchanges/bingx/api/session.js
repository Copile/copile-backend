const ExchangeSession = require("../../../trade/exchangeSession.js");
const { bulkOrder,
  cancelAllOrders,
  replaceSl,
  cancelAllTps,
  bulkTp,
  partialClose,
  sendSl,
  cancelOrder } = require('../execution.js');
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

  async bulkOrder(data) {
    try {
      return await bulkOrder(this.apiKey, this.apiSecret, data);
    } catch (e) {
      if (e instanceof CustomError) {
        throw e;
      }
      throw new CustomError({
        message: `Failed to send bulkOrder : ${e.message}`,
        status: 500,
        source: "bulkOrder",
      });
    }
  }

  async cancelAllOrders(data) {
      try {
        return await cancelAllOrders(this.apiKey, this.apiSecret, data);
      } catch (e) {
        if (e instanceof CustomError) {
          throw e;
        }
        throw new CustomError({
          message: `Failed to send cancelAllOrders : ${e.message}`,
          status: 500,
          source: "cancelAllOrders",
        });
    }
  }

  async replaceSl(data) {
    try {
      return await replaceSl(this.apiKey, this.apiSecret, data);
    } catch (e) {
      if (e instanceof CustomError) {
        throw e;
      }
      throw new CustomError({
        message: `Failed to send replaceSl : ${e.message}`,
        status: 500,
        source: "replaceSl",
      });
    }
  }

  async cancelAllTps(data) {
    try {
      return await cancelAllTps(this.apiKey, this.apiSecret, data);
    } catch (e) {
      if (e instanceof CustomError) {
        throw e;
      }
      throw new CustomError({
        message: `Failed to send cancelAllTps : ${e.message}`,
        status: 500,
        source: "cancelAllTps",
      });
    }
  }

  async bulkTp(data) {
    try {
      return await bulkTp(this.apiKey, this.apiSecret, data);
    } catch (e) {
      if (e instanceof CustomError) {
        throw e;
      }
      throw new CustomError({
        message: `Failed to send bulkTp : ${e.message}`,
        status: 500,
        source: "bulkTp",
      });
    }
  }

  async partialClose(data) {
    try {
      return await partialClose(this.apiKey, this.apiSecret, data);
    } catch (e) {
      if (e instanceof CustomError) {
        throw e;
      }
      throw new CustomError({
        message: `Failed to send partialClose : ${e.message}`,
        status: 500,
        source: "partialClose",
      });
    }
  }

  async sendSl(data) {
    try {
      return await sendSl(this.apiKey, this.apiSecret, data);
    } catch (e) {
      if (e instanceof CustomError) {
        throw e;
      }
      throw new CustomError({
        message: `Failed to send sendSl : ${e.message}`,
        status: 500,
        source: "sendSl",
      });
    }
  }

  async cancelOrder(data) {
    try {
      return await cancelOrder(this.apiKey, this.apiSecret, data);
    } catch (e) {
      if (e instanceof CustomError) {
        throw e;
      }
      throw new CustomError({
        message: `Failed to send cancelOrder : ${e.message}`,
        status: 500,
        source: "cancelOrder",
      });
    }
  }

}

module.exports = BingXSession;
