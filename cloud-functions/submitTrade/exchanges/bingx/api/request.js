const cryptoJs = require("crypto-js");
const axios = require("axios");
const CustomError = require("../../../utils/error.js");

const apiConfig = {
  host: "open-api.bingx.com",
  protocol: "https",
};

const recvWindow = 5000;

/**
 * Fetches the current server time from BingX API.
 * @return {Promise<number>} Server time.
 */
async function getServerTime() {
  const path = "/openApi/swap/v2/server/time";
  const url = `${apiConfig.protocol}://${apiConfig.host}${path}`;
  const response = await axios.get(url, { timeout: 5000 });
  const serverTime = response.data.data.serverTime;
  return serverTime;
}

/**
 * Constructs the URL and sends the signed API request.
 * @param {string} path API endpoint path.
 * @param {Object} payload API request payload.
 * @param {string} apiKey API key.
 * @param {string} apiSecret API secret.
 * @return {Promise<Object>} API response data.
 */
async function makeSignedRequest(method, path, payload, apiKey, apiSecret) {
  // Add the timestamp to the payload before creating the signature
  payload.timestamp = await getServerTime();

  const params = new URLSearchParams(payload).toString();
  const signature = cryptoJs.HmacSHA256(params, apiSecret).toString();
  const url = `${apiConfig.protocol}://${apiConfig.host}${path}?${params}&signature=${signature}`;
  const headers = { "X-BX-APIKEY": apiKey };

  try {
    let response;
    switch (method) {
      case 'GET':
        response = await axios.get(url, { headers, timeout: recvWindow });
        break;
      case 'POST':
        response = await axios.post(url, {}, { headers, timeout: recvWindow });
        break;
      case 'PATCH':
        response = await axios.patch(url, {}, { headers, timeout: recvWindow });
        break;
      case 'PUT':
        response = await axios.put(url, {}, { headers, timeout: recvWindow });
        break;
      case 'DELETE':
        response = await axios.delete(url, { headers, timeout: recvWindow });
        break;
      default:
        throw new CustomError({
          message: `Invalid method type: ${method}`,
          source: "makeSignedRequest",
          status: 400,
        });
    }
    return response.data.data;
  } catch (error) {
    if (error instanceof CustomError) throw error;

    throw new CustomError({
      message: `Failed to send BingX API request to ${path}: ${error.message}`,
      source: "makeSignedRequest",
      status: error.response?.status || 500,
    });
  }
}

/**
 * Fetches positions from BingX API.
 * @param {string} apiKey API key.
 * @param {string} apiSecret API secret.
 * @return {Promise<Array>} Positions.
 */
async function getPositions(apiKey, apiSecret) {
  const path = "/openApi/swap/v2/user/positions";
  const payload = {};
  return await makeSignedRequest("GET", path, payload, apiKey, apiSecret);
}

/**
 * Fetches an order by its symbol and order ID.
 * @param {string} apiKey API key.
 * @param {string} apiSecret API secret.
 * @param {string} symbol The symbol for which the order should be retrieved.
 * @param {string} orderId The order ID.
 * @return {Promise<Object>} The order.
 */
async function getOrder(apiKey, apiSecret, symbol, orderId) {
  const path = "/openApi/swap/v2/trade/order";
  const payload = {
    symbol,
    orderId: BigInt(orderId),
  };
  return await makeSignedRequest("GET", path, payload, apiKey, apiSecret);
}

/**
 * Fetches the balance for an account.
 * @param {string} apiKey API key.
 * @param {string} apiSecret API secret.
 * @return {Promise<Object>} The balance.
 */
async function getBalance(apiKey, apiSecret) {
  const path = "/openApi/swap/v2/user/balance";
  const payload = {};
  return await makeSignedRequest("GET", path, payload, apiKey, apiSecret);
}

/**
 * Fetches open orders.
 * @param {string} apiKey API key.
 * @param {string} apiSecret API secret.
 * @param {boolean} checkStatus Flag to check the status of the orders.
 * @return {Promise<Array>} The orders.
 */
async function getOrders(apiKey, apiSecret) {
  const path = "/openApi/swap/v2/trade/openOrders";
  const payload = {};
  const data = await makeSignedRequest("GET", path, payload, apiKey, apiSecret);
  try {
    if (!data || !data.orders) return;
    const orders = data.orders;
    return orders.filter((order) => order.type === "LIMIT");
  } catch (error) {
    throw new CustomError({
      message: `Failed to get BingX open orders: ${error.message}`,
      status: 400,
      source: "getOrders",
    });
  }
}

async function getOrderStatuses(apiKey, apiSecret, symbol) {
  const path = "/openApi/swap/v2/trade/openOrders";
  const payload = { symbol: symbol };
  const data = await makeSignedRequest("GET", path, payload, apiKey, apiSecret);
  try {
    if (!data || !data.orders) return;
    const orders = data.orders;
    return orders;
  } catch (error) {
    throw new CustomError({
      message: `Failed to get BingX open orders: ${error.message}`,
      status: 400,
      source: "getOrderStatuses",
    });
  }
}

module.exports = {
  makeSignedRequest,
  getServerTime,
  getPositions,
  getOrder,
  getOrders,
  getBalance,
  getOrderStatuses,
};
