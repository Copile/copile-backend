const CryptoJS = require("crypto-js");
const axios = require("axios");
const querystring = require("querystring");
const CustomError = require("../../utils/error");

const API_HOST = "fapi.binance.com";
const API_PROTOCOL = "https";
const TIMEOUT = 1000 * 60 * 3; // 3 minutes

/**
 * Make a signed request to the Binance API.
 *
 * @param {string} url - API endpoint URL.
 * @param {Object} payload - Request payload.
 * @param {string} apiKey - User's API key.
 * @param {string} apiSecret - User's API secret.
 * @returns {Promise<Object>} - The response data.
 * @throws {CustomError} - When the request fails.
 */
async function makeSignedRequest(url, payload, apiKey, apiSecret) {
  const queryString = querystring.stringify(payload);
  const signature = CryptoJS.HmacSHA256(queryString, apiSecret).toString(
    CryptoJS.enc.Hex
  );
  const headers = {
    "X-MBX-APIKEY": apiKey,
  };

  try {
    const response = await axios.get(
      `${url}?${queryString}&signature=${signature}`,
      { headers, timeout: TIMEOUT }
    );
    return response.data;
  } catch (error) {
    throw new CustomError({
      message: `Request to ${url} failed: ${error.message}`,
      status: 400,
      source: "makeSignedRequest",
    });
  }
}

/**
 * Retrieve the current server time from Binance.
 *
 * @returns {Promise<number>} - The server time in milliseconds.
 * @throws {CustomError} - When the request for server time fails.
 */
async function getServerTime() {
  //const url = `${API_PROTOCOL}://${API_HOST}/fapi/v1/time`;
  try {
    //const response = await axios.get(url);
    // create and give back a timestamp in milliseconds
    return Date.now();
  } catch (error) {
    throw new CustomError({
      message: `Failed to get Binance server time: ${error.message}`,
      status: 400,
      source: "getServerTime",
    });
  }
}

/**
 * Retrieve the user's current positions from Binance.
 *
 * @param {string} apiKey - User's API key.
 * @param {string} apiSecret - User's API secret.
 * @returns {Promise<Array>} - List of positions.
 * @throws {CustomError} - When the request for positions fails.
 */
async function getPositions(apiKey, apiSecret) {
  const timestamp = await getServerTime();
  const url = `${API_PROTOCOL}://${API_HOST}/fapi/v2/positionRisk`;
  const payload = { timestamp, recvWindow: 5000 };

  try {
    const data = await makeSignedRequest(url, payload, apiKey, apiSecret);
    if(!data.length) return [];
    return data
      .filter((pos) => parseFloat(pos.positionAmt) !== 0)
      .map((pos) => ({
        ...pos,
        positionSide: parseFloat(pos.positionAmt) < 0 ? "SHORT" : "LONG",
      }));
  } catch (error) {
    throw new CustomError({
      message: `Failed to get Binance positions: ${error.message}`,
      status: 400,
      source: "getPositions",
    });
  }
}

/**
 * Retrieve the status of a specific order by symbol and orderId.
 *
 * @param {string} symbol - Asset symbol.
 * @param {string} orderId - Order ID.
 * @param {string} apiKey - User's API key.
 * @param {string} apiSecret - User's API secret.
 * @returns {Promise<string>} - Order status.
 * @throws {CustomError} - When the request for the order status fails.
 */
async function getOrder(symbol, orderId, apiKey, apiSecret) {
  const timestamp = await getServerTime();
  const url = `${API_PROTOCOL}://${API_HOST}/fapi/v1/order`;
  const payload = { symbol, orderId, timestamp };

  try {
    const data = await makeSignedRequest(url, payload, apiKey, apiSecret);
    return data.status;
  } catch (error) {
    throw new CustomError({
      message: `Failed to get Binance order: ${error.message}`,
      status: 400,
      source: "getOrder",
    });
  }
}

/**
 * Retrieve the user's open orders from Binance.
 *
 * @param {string} apiKey - User's API key.
 * @param {string} apiSecret - User's API secret.
 * @param {boolean} [isTpOrSl=false] - Whether to include take profit/stop loss orders.
 * @returns {Promise<Array>} - List of open orders.
 * @throws {CustomError} - When the request for open orders fails.
 */
async function getOrders(apiKey, apiSecret) {
  const timestamp = await getServerTime();
  const url = `${API_PROTOCOL}://${API_HOST}/fapi/v1/openOrders`;
  const payload = { timestamp, recvWindow: 5000 };

  try {
    const data = await makeSignedRequest(url, payload, apiKey, apiSecret);
    if(!data.length) return [];
    return data.filter((order) => order.type === "LIMIT");
  } catch (error) {
    throw new CustomError({
      message: `Failed to get Binance open orders: ${error.message}`,
      status: 400,
      source: "getOrders",
    });
  }
}

async function getOrderStatuses(apiKey, apiSecret, symbol) {
  const timestamp = await getServerTime();
  const url = `${API_PROTOCOL}://${API_HOST}/fapi/v1/openOrders`;
  const payload = { symbol, timestamp, recvWindow: 5000 };

  try {
    const data = await makeSignedRequest(url, payload, apiKey, apiSecret);
    if(!data.length) return [];
    console.log(data);
    return data;
  } catch (error) {
    throw new CustomError({
      message: `Failed to get Binance open orders: ${error.message}`,
      status: 400,
      source: "getOrders",
    });
  }
}

/**
 * Retrieve the user's balance of the asset "USDT" from Binance.
 *
 * @param {string} apiKey - User's API key.
 * @param {string} apiSecret - User's API secret.
 * @returns {Promise<Array>} - List of USDT balances.
 * @throws {CustomError} - When the request for the balance fails.
 */
async function getBalance(apiKey, apiSecret) {
  const timestamp = await getServerTime();
  const url = `${API_PROTOCOL}://${API_HOST}/fapi/v2/balance`;
  const payload = { timestamp };

  try {
    const data = await makeSignedRequest(url, payload, apiKey, apiSecret);
    return data.filter((asset) => asset.asset === "USDT");
  } catch (error) {
    throw new CustomError({
      message: `Failed to get Binance balance: ${error.message}`,
      status: 400,
      source: "getBalance",
    });
  }
}

module.exports = {
  getPositions,
  getOrder,
  getOrders,
  getBalance,
  getOrderStatuses,
};
