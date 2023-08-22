const CryptoJS = require("crypto-js");
const axios = require('axios');

const api = {
  host: "open-api.bingx.com",
  protocol: "https",
};

// Function to generate the server timestamp
async function generateTimestamp() {
  const servertimeuri = "/openApi/swap/v2/server/time";
  const url = `${api.protocol}://${api.host}${servertimeuri}`;
  const response = await axios.get(url);
  return response.data.data.serverTime;
}

async function getBalance(apiKey, apiSecret) {
    try {
        const timestamp = await generateTimestamp();

        // Prepare the payload and parameters
        const payload = { timestamp };
        const parameters = new URLSearchParams(payload).toString();

        // Generate the signature
        const signedParams = `${parameters}&signature=${CryptoJS.HmacSHA256(parameters, apiSecret)}`;
        const url = `${api.protocol}://${api.host}/openApi/swap/v2/user/balance?${signedParams}`;

        // Set the headers
        const headers = {
            'X-BX-APIKEY': apiKey,
        };

        // Send the request
        const response = await axios.get(url, { headers, timeout: 1000 * 60 * 3 });
        return response;
    } catch (error) {
        console.error('An error occurred:', error.message);
        return null;
    }
}

module.exports = {
  getBalance,
};