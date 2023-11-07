const { makeSignedRequest } = require('./request.js')

async function tradeOrder(
  apiKey, 
  apiSecret, 
  symbol, 
  type,
  side,
  positionSide = null,
  price = null,
  stopPrice = null,
  quantity = null, 
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
  return await makeSignedRequest("POST", path, payload, apiKey, apiSecret);
}

async function bulkOrder(
  apiKey,
  apiSecret,
  batchOrders,
) {
  const path = "/openApi/swap/v2/trade/batchOrders";
  const payload = {};
  return await makeSignedRequest("POST", path, payload, apiKey, apiSecret);
}

async function closeAllPositions(
  apiKey,
  apiSecret
) {
  const path = "/openApi/swap/v2/trade/closeAllPositions";
  const payload = {};
  return await makeSignedRequest("POST", path, payload, apiKey, apiSecret);
}

async function cancelOrder(
  apiKey,
  apiSecret,
  orderId,
  symbol,
) {
  const path = "/openApi/swap/v2/trade/order";
  const payload = {
      orderId,
      symbol,
      recvWindow,
  };
  return await makeSignedRequest("DELETE", path, payload, apiKey, apiSecret);
}

async function cancelOrders(
  apiKey,
  apiSecret,
  symbol,
  orderIdList,
) {
  const path = "/openApi/swap/v2/trade/batchOrders";
  const payload = {
      symbol,
      orderIdList,
  };
  return await makeSignedRequest("DELETE", path, payload, apiKey, apiSecret);
}

async function cancelAllOrders(
  apiKey,
  apiSecret,
  symbol
) {
  const path = "/openApi/swap/v2/trade/allOpenOrders";
  const payload = {
      symbol
  };
  return await makeSignedRequest("POST", path, payload, apiKey, apiSecret);
}

async function currentOrders(
  apiKey,
  apiSecret,
  symbol
) {
  const path = "/openApi/swap/v2/trade/openOrders";
  const payload = {
      symbol
  };
  return await makeSignedRequest("GET", path, payload, apiKey, apiSecret);
}

async function getOrder(
  apiKey,
  apiSecret,
  symbol,
  orderId
) {
  const path = "/openApi/swap/v2/trade/order";
  const payload = {
      symbol,
      orderId
  };
  return await makeSignedRequest("GET", path, payload, apiKey, apiSecret);
}

async function marginMode(
  apiKey,
  apiSecret,
  symbol
) {
  const path = "/openApi/swap/v2/trade/marginType";
  const payload = {
      symbol
  };
  return await makeSignedRequest("GET", path, payload, apiKey, apiSecret);
}

async function switchMarginMode(
  apiKey,
  apiSecret,
  symbol,
  marginType
) {
  const path = "/openApi/swap/v2/trade/marginType";
  const payload = {
      symbol,
      marginType
  };
  return await makeSignedRequest("POST", path, payload, apiKey, apiSecret);
}

async function getLeverage(
  apiKey,
  apiSecret,
  symbol,
) {
  const path = "/openApi/swap/v2/trade/leverage";
  const payload = {
      symbol
  };
  return await makeSignedRequest("GET", path, payload, apiKey, apiSecret);
}

async function switchLeverage(
  apiKey,
  apiSecret,
  symbol,
  side,
  leverage
) {
  const path = "/openApi/swap/v2/trade/leverage";
  const payload = {
      symbol,
      side,
      leverage
  };
  return await makeSignedRequest("POST", path, payload, apiKey, apiSecret);
}

async function forceOrders(
  apiKey,
  apiSecret,
  symbol = null,
  autoCloseType = null,
  startTime = null,
  endTime = null,
  limit = null,
) {
  const path = "/openApi/swap/v2/trade/forceOrders";
  const payload = {
      symbol,
      autoCloseType,
      startTime,
      endTime,
      limit
  };
  return await makeSignedRequest("GET", path, payload, apiKey, apiSecret);
}

async function ordersHistory(
  apiKey,
  apiSecret,
  symbol,
  orderId = null,
  startTime = null,
  endTime = null,
  limit = 500
) {
  const path = "/openApi/swap/v2/trade/allOrders";
  const payload = {
      symbol,
      orderId,
      startTime,
      endTime,
      limit
  };
  return await makeSignedRequest("GET", path, payload, apiKey, apiSecret);
}

async function adjustIsolatedMargin(
  apiKey,
  apiSecret,
  symbol,
  amount,
  type,
  positionSide = null
) {
  const path = "/openApi/swap/v2/trade/positionMargin";
  const payload = {
      symbol,
      amount,
      type,
      positionSide
  };
  return await makeSignedRequest("GET", path, payload, apiKey, apiSecret);
}

module.exports = {
  tradeOrder,
  bulkOrder,
  closeAllPositions,
  cancelAllOrders,
  cancelOrder,
  cancelOrders,
  currentOrders,
  getOrder,
  getLeverage,
  marginMode,
  switchLeverage,
  switchMarginMode,
  ordersHistory,
  adjustIsolatedMargin
}