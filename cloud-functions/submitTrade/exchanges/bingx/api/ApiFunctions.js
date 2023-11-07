const { makeSignedRequest, getServerTime } = require('./request.js')

/**
 * Fetches an order by its symbol and order ID.
 * @param {string} apiKey API key.
 * @param {string} apiSecret API secret.
 * @param {string} symbol The symbol for which the order should be retrieved.
 * @param {string} orderId The order ID.
 * @return {Promise<Object>} The order.
 */
async function tradeOrder(
    apiKey, 
    apiSecret, 
    symbol, 
    type,
    side,
    positionSide = null,
    price = null,
    quantity = null, 
    ) {
    const path = "/openApi/swap/v2/trade/order";
    const payload = {
      symbol,
      orderId: BigInt(orderId),
      timestamp: await getServerTime(),
    };
    return await makeSignedRequest(path, payload, apiKey, apiSecret);
  }