const cryptoJs = require("crypto-js");
const axios = require("axios");
const CustomError = require("../../utils/error");

const apiConfig = {
  host: "open-api.bingx.com",
  protocol: "https",
};

/**
 * Constructs the URL and sends the signed API request.
 * @param {string} path API endpoint path.
 * @param {Object} payload API request payload.
 * @param {string} apiKey API key.
 * @param {string} apiSecret API secret.
 * @return {Promise<Object>} API response data.
 */
async function makeSignedRequest(path, payload, apiKey, apiSecret) {
  const params = new URLSearchParams(payload).toString();
  const signature = cryptoJs.HmacSHA256(params, apiSecret).toString();
  const url = `${apiConfig.protocol}://${apiConfig.host}${path}?${params}&signature=${signature}`;
  const headers = { "X-BX-APIKEY": apiKey };

  try {
    const response = await axios.get(url, { headers, timeout: 5000 });
    return response.data.data;
  } catch (error) {
    throw new CustomError({
      message: `Failed to send BingX API request to ${path}: ${error.message}`,
      source: "makeSignedRequest",
      status: 500,
    });
  }
}

/**
 * Fetches the current server time from BingX API.
 * @return {Promise<number>} Server time.
 */
async function getServerTime() {
  const path = "/openApi/swap/v2/server/time";
  const { serverTime } = await makeSignedRequest(path, {}, "", "");
  return serverTime;
}

/**
 * Fetches positions from BingX API.
 * @param {string} apiKey API key.
 * @param {string} apiSecret API secret.
 * @return {Promise<Array>} Positions.
 */
async function getPositions(apiKey, apiSecret) {
  const path = "/openApi/swap/v2/user/positions";
  const payload = { timestamp: await getServerTime() };
  return makeSignedRequest(path, payload, apiKey, apiSecret);
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
    timestamp: await getServerTime(),
  };
  return makeSignedRequest(path, payload, apiKey, apiSecret);
}

/**
 * Fetches the balance for an account.
 * @param {string} apiKey API key.
 * @param {string} apiSecret API secret.
 * @return {Promise<Object>} The balance.
 */
async function getBalance(apiKey, apiSecret) {
  const path = "/openApi/swap/v2/user/balance";
  const payload = { timestamp: await getServerTime() };
  return makeSignedRequest(path, payload, apiKey, apiSecret);
}

/**
 * Fetches open orders.
 * @param {string} apiKey API key.
 * @param {string} apiSecret API secret.
 * @param {boolean} checkStatus Flag to check the status of the orders.
 * @return {Promise<Array>} The orders.
 */
async function getOrders(apiKey, apiSecret, isTpOrSl = false) {
  const path = "/openApi/swap/v2/trade/openOrders";
  const payload = { timestamp: await getServerTime() };
  const orders = await makeSignedRequest(path, payload, apiKey, apiSecret);

  return isTpOrSl ? orders : orders.filter((order) => order.type === "LIMIT");
}

module.exports = {
  getPositions,
  getOrder,
  getOrders,
  getBalance,
};
