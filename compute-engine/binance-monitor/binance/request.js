const CryptoJS = require("crypto-js");
const axios = require("axios");
const querystring = require("querystring");
const CustomError = require("../firestore/error.js");

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
    
    if (!data) return;
    return data.status;
  } catch (error) {
    throw new CustomError({
      message: `Failed to get Binance order: ${error.message}`,
      status: 400,
      source: "getOrder",
    });
  }
}

module.exports = {
  getOrder,
};
