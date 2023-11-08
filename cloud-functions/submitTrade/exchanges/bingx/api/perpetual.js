const BingXSession = require("../api/session.js");
const { makeSignedRequest } = require('../api/request.js');

/**
 * Represents a BingX exchange session.
 * @extends BingXSession
 */
class BingXFunctions extends BingXSession {
  /**
   * Creates a BingXSession instance.
   * @param {string} apiKey - API key for the BingX session.
   * @param {string} apiSecret - API secret for the BingX session.
   */
  constructor(apiKey, apiSecret) {
    super(apiKey, apiSecret);
  }

  async tradeOrder(
    symbol, 
    type,
    side,
    price = null,
    quantity = null,
    positionSide = null,
    stopPrice = null,
  ) {
    const path = "/openApi/swap/v2/trade/order";
    const payload = {
        symbol,
        type,
        side,
        positionSide,
        price,
        quantity,
        stopPrice
    };
    return await makeSignedRequest("POST", path, payload, this.apiKey, this.apiSecret);
  }

  async bulkOrder(batchOrders) {
    const path = "/openApi/swap/v2/trade/batchOrders";
    const payload = {};
    return await makeSignedRequest("POST", path, payload, this.apiKey, this.apiSecret);
  }

  async closeAllPositions() {
    const path = "/openApi/swap/v2/trade/closeAllPositions";
    const payload = {};
    return await makeSignedRequest("POST", path, payload, this.apiKey, this.apiSecret);
  }

  async cancelOrder(orderId, symbol) {
    const path = "/openApi/swap/v2/trade/order";
    const payload = {
        orderId,
        symbol,
    };
    return await makeSignedRequest("DELETE", path, payload, this.apiKey, this.apiSecret);
  }

  async cancelOrders(symbol, orderIdList) {
    const path = "/openApi/swap/v2/trade/batchOrders";
    const payload = {
        symbol,
        orderIdList,
    };
    return await makeSignedRequest("DELETE", path, payload, this.apiKey, this.apiSecret);
  }

  async cancelAllOrders(symbol) {
    const path = "/openApi/swap/v2/trade/allOpenOrders";
    const payload = {
        symbol
    };
    return await makeSignedRequest("POST", path, payload, this.apiKey, this.apiSecret);
  }

  async currentOrders(symbol) {
    const path = "/openApi/swap/v2/trade/openOrders";
    const payload = {
        symbol
    };
    return await makeSignedRequest("GET", path, payload, this.apiKey, this.apiSecret);
  }

  async getOrder(symbol, orderId) {
    const path = "/openApi/swap/v2/trade/order";
    const payload = {
        symbol,
        orderId
    };
    return await makeSignedRequest("GET", path, payload, this.apiKey, this.apiSecret);
  }

  async marginMode(symbol) {
    const path = "/openApi/swap/v2/trade/marginType";
    const payload = {
        symbol
    };
    return await makeSignedRequest("GET", path, payload, this.apiKey, this.apiSecret);
  }

  async switchMarginMode(symbol, marginType) {
    const path = "/openApi/swap/v2/trade/marginType";
    const payload = {
      symbol,
      marginType
    };

    try {
      return await makeSignedRequest("POST", path, payload, this.apiKey, this.apiSecret);
    } catch (error) {
      return;
    }
  }

  async getLeverage(symbol) {
    const path = "/openApi/swap/v2/trade/leverage";
    const payload = {
        symbol
    };
    return await makeSignedRequest("GET", path, payload, this.apiKey, this.apiSecret);
  }

  async switchLeverage(symbol, side, leverage) {
    const path = "/openApi/swap/v2/trade/leverage";
    
    let leverageSide = side == "Buy" ? "LONG" : "SHORT"
    
    const payload = {
        symbol,
        leverageSide,
        leverage
    };
    return await makeSignedRequest("POST", path, payload, this.apiKey, this.apiSecret);
  }

  async forceOrders(symbol = null, autoCloseType = null, startTime = null, endTime = null, limit = null) {
    const path = "/openApi/swap/v2/trade/forceOrders";
    const payload = {
        symbol,
        autoCloseType,
        startTime,
        endTime,
        limit
    };
    return await makeSignedRequest("GET", path, payload, this.apiKey, this.apiSecret);
  }

  async getPosition(
    symbol
  ) {
    const path = "/openApi/swap/v2/user/positions";
    const payload = {symbol};
    return await makeSignedRequest("GET", path, payload, this.apiKey, this.apiSecret);
  }

  async ordersHistory(symbol, orderId = null, startTime = null, endTime = null, limit = 500) {
    const path = "/openApi/swap/v2/trade/allOrders";
    const payload = {
        symbol,
        orderId,
        startTime,
        endTime,
        limit
    };
    return await makeSignedRequest("GET", path, payload, this.apiKey, this.apiSecret);
  }

  async getMarket(
    symbol
  ) {
    const path = "/openApi/swap/v2/quote/ticker";
    const payload = {symbol};
    return await makeSignedRequest("GET", path, payload, apiKey, apiSecret);
  }

  async getPrecisions(symbol) {
    const path = "/openApi/swap/v2/quote/contracts";
    const payload = {};
  
    try {
      const precisions = await makeSignedRequest("GET", path, payload, this.apiKey, this.apiSecret);
      const precisionsDict = precisions.reduce((acc, precision) => {
        acc[precision.symbol] = precision;
        return acc;
      }, {});
  
      const symbolPrecision = precisionsDict[symbol] || {};
      const quantityPrecision = symbolPrecision.quantityPrecision;
      const pricePrecision = symbolPrecision.pricePrecision;
      const minQty = parseFloat(symbolPrecision.size);
  
      return {
        quantityPrecision,
        pricePrecision,
        minQty
      };
    } catch (error) {
      console.error('Error fetching precisions:', error);
      return {};
    }
  }

  async adjustIsolatedMargin(symbol, amount, type, positionSide = null) {
    const path = "/openApi/swap/v2/trade/positionMargin";
    const payload = {
        symbol,
        amount,
        type,
        positionSide
    };
    return await makeSignedRequest("GET", path, payload, this.apiKey, this.apiSecret);
  }
}

module.exports = BingXFunctions;
