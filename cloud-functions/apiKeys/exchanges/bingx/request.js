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
    return response;
  } catch (error) {
    if(error instanceof CustomError) throw error;

    throw new CustomError({
      message: `Failed to send BingX API request to ${path}: ${error.message}`,
      source: "makeSignedRequest",
      status: 500,
    });
  }
}

async function getAPIPerms(apiKey, apiSecret) {
  const timestamp = await getServerTime();
  const url = `${API_PROTOCOL}://${API_HOST}/openApi/v1/account/apiRestrictions`;
  const payload = { timestamp, recvWindow: 5000 };

  try {
    const response = await makeSignedRequest(url, payload, apiKey, apiSecret);
    if (response.status === 200 && response.data) {
      return response.data;
    }
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }
    throw new CustomError({
      message: `Failed to get BingX API Key Permissions: ${
        error.message || error
      }`,
      status: 400,
      source: "getAPIPerms",
    });
  }
}

module.exports = {
  getAPIPerms,
};
