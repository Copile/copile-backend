const CryptoJS = require("crypto-js");
const axios = require("axios");
const querystring = require("querystring");
const CustomError = require("../../utils/error");

const API_HOST = "api.binance.com";
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
    console.log(response);
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
  try {
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
async function getAPIPerms(apiKey, apiSecret) {
  const timestamp = await getServerTime();
  const url = `${API_PROTOCOL}://${API_HOST}/sapi/v1/account/apiRestrictions`;
  const payload = { timestamp, recvWindow: 5000 };
  try {
    const data = await makeSignedRequest(url, payload, apiKey, apiSecret);
    return data;
  } catch (error) {
    throw new CustomError({
      message: `Failed to get Binance APi Key Permissions: ${error.message}`,
      status: 400,
      source: "getAPIPerms",
    });
  }
}

module.exports = {
  getAPIPerms
};
