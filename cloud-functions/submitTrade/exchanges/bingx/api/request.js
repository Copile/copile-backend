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
  
  const config = {
    method: method,
    url: url,
    headers: headers,
  }
  
  try {
    let response;
    switch (method) {
        case 'GET':
            response = await axios.get(url, { headers });
            break;
        case 'POST':
        case 'PATCH':
        case 'PUT':
        case 'DELETE':
            response = await axios({ method, url, headers });
            break;
        default:
            throw new CustomError({
                message: `Invalid method type: ${method}`,
                source: "makeSignedRequest",
                status: 400,
            });
    }

    console.log(`Request Payload: ${JSON.stringify(payload)}`);
    console.log(`Response: ${JSON.stringify(response.data)}`);
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

module.exports = {
  makeSignedRequest,
  getServerTime,
};
