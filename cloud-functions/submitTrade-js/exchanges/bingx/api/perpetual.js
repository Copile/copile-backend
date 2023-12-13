const { makeSignedRequest } = require('./request.js');

/**
 * Represents a BingX exchange session.
 * @extends BingXSession
 */
class BingXFunctions {
  /**
   * Creates a BingXSession instance.
   * @param {string} apiKey - API key for the BingX session.
   * @param {string} apiSecret - API secret for the BingX session.
   */
  constructor(apiKey, apiSecret) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  async tradeOrder(order) {
    const path = "/openApi/swap/v2/trade/order";

    Object.keys(order).forEach(key => {
        if (order[key] === null) {
            delete order[key];
        }
    });

    return await makeSignedRequest("POST", path, order, this.apiKey, this.apiSecret);
  }

  async bulkOrder(batchOrders) {
    const path = "/openApi/swap/v2/trade/batchOrders";
    
    const cleanedBatchOrders = batchOrders.map(order => {
        Object.keys(order).forEach(key => {
            if (order[key] === null) {
                delete order[key];
            }
        });
        return order;
    });

    let orders = JSON.stringify(cleanedBatchOrders);

    const payload = {
        "batchOrders": orders,
    };
    
    return await makeSignedRequest("POST", path, payload, this.apiKey, this.apiSecret);
  }

  async closeAllPositions() {
    const path = "/openApi/swap/v2/trade/closeAllPositions";
    const payload = {};
    return await makeSignedRequest("POST", path, payload, this.apiKey, this.apiSecret);
  }

  async cancelOrder(symbol, orderId, clientOrderID) {
    const path = "/openApi/swap/v2/trade/order";
    
    let payload = {
      symbol,
    }

    if (orderId !== null) {
      payload.orderId = orderId
    } else {
      payload.clientOrderID = clientOrderID
    }

    return await makeSignedRequest("DELETE", path, payload, this.apiKey, this.apiSecret);
  }

  async cancelOrders(symbol, orderIdList, ClientOrderIDList) {
    const path = "/openApi/swap/v2/trade/batchOrders";
    
    let payload = {
      symbol,
    }
    
    if (orderIdList !== null) {
      payload.orderIdList = orderIdList
    } else {
      payload.ClientOrderIDList = ClientOrderIDList
    }

    return await makeSignedRequest("DELETE", path, payload, this.apiKey, this.apiSecret);
  }

  async cancelAllOrders(symbol) {
    const path = "/openApi/swap/v2/trade/allOpenOrders";
    const payload = {
        symbol
    };
    return await makeSignedRequest("DELETE", path, payload, this.apiKey, this.apiSecret);
  }

  async currentOrders(symbol) {
    const path = "/openApi/swap/v2/trade/openOrders";
    const payload = {
        symbol
    };
    return await makeSignedRequest("GET", path, payload, this.apiKey, this.apiSecret);
  }

  async getOrder(symbol, orderId, clientOrderID) {
    const path = "/openApi/swap/v2/trade/order";
    
    let payload = {
      symbol,
    }

    if (orderId !== null) {
      payload.orderId = orderId
    } else {
      payload.clientOrderID = clientOrderID
    }

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

  async setLeverage(symbol, side, leverage) {
    const path = "/openApi/swap/v2/trade/leverage";
    
    let leverageSide = side == "Buy" ? "LONG" : "SHORT"
    
    const payload = {
        symbol,
        "side": leverageSide,
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
    return await makeSignedRequest("GET", path, payload, this.apiKey, this.apiSecret);
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
