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

  return await axios.get(url, { headers, timeout: 5000 });
}

/**
 * Fetches the current server time from BingX API.
 * @return {Promise<number>} Server time.
 */
async function getServerTime() {
  const path = "/openApi/swap/v2/server/time";
  const url = `${apiConfig.protocol}://${apiConfig.host}${path}`;
  const response = await axios.get(url, { timeout: 5000 });
  return response.data.data.serverTime;
}

async function getAPIPerms(apiKey, apiSecret) {
  const path = "/openApi/v1/account/apiRestrictions";
  const payload = { timestamp: await getServerTime(), recvWindow: 5000 };

  return await makeSignedRequest(path, payload, apiKey, apiSecret);
}

module.exports = {
  getAPIPerms,
};
