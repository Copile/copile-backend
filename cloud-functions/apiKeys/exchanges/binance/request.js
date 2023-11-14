const CryptoJS = require("crypto-js");
const axios = require("axios");
const querystring = require("querystring");
const CustomError = require("../../utils/error");

const API_HOST = "api.binance.com";
const API_PROTOCOL = "https";
const TIMEOUT = 1000 * 60 * 3; // 3 minutes

async function makeSignedRequest(url, payload, apiKey, apiSecret) {
  const queryString = querystring.stringify(payload);
  const signature = CryptoJS.HmacSHA256(queryString, apiSecret).toString(
    CryptoJS.enc.Hex
  );
  const headers = {
    "X-MBX-APIKEY": apiKey,
  };

  return await axios.get(`${url}?${queryString}&signature=${signature}`, {
    headers,
    timeout: TIMEOUT,
  });
}

async function getServerTime() {
  return Date.now();
}

async function getAPIPerms(apiKey, apiSecret) {
  const timestamp = await getServerTime();
  const url = `${API_PROTOCOL}://${API_HOST}/sapi/v1/account/apiRestrictions`;
  const payload = { timestamp, recvWindow: 5000 };

  return await makeSignedRequest(url, payload, apiKey, apiSecret);
}

module.exports = {
  getAPIPerms,
};
