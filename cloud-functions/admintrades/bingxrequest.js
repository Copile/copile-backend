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

// Function to send a request to GET /openApi/swap/v2/user/positions
async function getPositions(apiKey, apiSecret) {
  try {
    const timestamp = await generateTimestamp();

    // Prepare the payload and parameters
    const payload = { timestamp };
    const parameters = new URLSearchParams(payload).toString();

    // Generate the signature
    const signedParams = `${parameters}&signature=${CryptoJS.HmacSHA256(parameters, apiSecret)}`;
    const url = `${api.protocol}://${api.host}/openApi/swap/v2/user/positions?${signedParams}`;

    // Set the headers
    const headers = {
      'X-BX-APIKEY': apiKey,
    };

    // Send the request
    const response = await axios.get(url, { headers, timeout: 5000 });

    return response.data.data;
  } catch (error) {
    console.error('An error occurred:', error.message);
    return null;
  }
}

// Function to send a request to GET /openApi/swap/v2/trade/order
async function getOrder(apiKey, apiSecret, symbol, orderId) {
  try {
    const timestamp = await generateTimestamp();

    // Prepare the payload and parameters
    const payload = {
      symbol: symbol,
      orderId: BigInt(orderId),
      timestamp: timestamp
    };
    const parameters = new URLSearchParams(payload).toString();

    // Generate the signature
    const signedParams = `${parameters}&signature=${CryptoJS.HmacSHA256(parameters, apiSecret)}`;
    const url = `${api.protocol}://${api.host}/openApi/swap/v2/trade/order?${signedParams}`;

    // Set the headers
    const headers = {
      'X-BX-APIKEY': apiKey,
    };

    // Send the request
    const response = await axios.get(url, { headers, timeout: 5000 });

    return response.data["data"]["order"]["status"];
  } catch (error) {
    console.log('An error occurred:', error);
    return null;
  }
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
        const response = await axios.get(url, { headers, timeout: 5000 });
        return response;
    } catch (error) {
        console.error('An error occurred:', error.message);
        return null;
    }
}

// Function to send a request to GET /openApi/swap/v2/trade/openOrders
async function getOrders(apiKey, apiSecret, checkStatus = false) {
  try {
    const timestamp = await generateTimestamp();

    // Prepare the payload and parameters
    const payload = {
      timestamp: timestamp
    };
    const parameters = new URLSearchParams(payload).toString();

    // Generate the signature
    const signedParams = `${parameters}&signature=${CryptoJS.HmacSHA256(parameters, apiSecret)}`;
    const url = `${api.protocol}://${api.host}/openApi/swap/v2/trade/openOrders?${signedParams}`;

    // Set the headers
    const headers = {
      'X-BX-APIKEY': apiKey,
    };

    // Send the request
    const response = await axios.get(url, { headers, timeout: 5000 });

    let orders = response.data.data.orders;
    if(!checkStatus) {
      // Filter orders of type "LIMIT" only
      orders = response.data.data.orders.filter(order => order.type === 'LIMIT');
    }
    return orders;
  } catch (error) {
    console.log('An error occurred:', error);
    return null;
  }
}

module.exports = {
  getPositions,
  getOrder,
  getOrders,
  getBalance
};