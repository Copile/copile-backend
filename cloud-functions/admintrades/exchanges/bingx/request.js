const CryptoJS = require("crypto-js");
const axios = require('axios');

const api = {
  host: "open-api.bingx.com",
  protocol: "https",
};

async function getServerTime() {
  try {
    const url = `${api.protocol}://${api.host}/openApi/swap/v2/server/time`;
    const response = await axios.get(url);
    return response.data.data.serverTime;
  } catch (error) {
    throw new Error(`Failed to get BingX server time: ${error.message}`);
  }
}

async function getPositions(apiKey, apiSecret) {
  try {
    const timestamp = await getServerTime();
    const payload = { timestamp };
    const parameters = new URLSearchParams(payload).toString();
    const signature = CryptoJS.HmacSHA256(parameters, apiSecret).toString();
    const url = `${api.protocol}://${api.host}/openApi/swap/v2/user/positions?${parameters}&signature=${signature}`;
    const headers = { 'X-BX-APIKEY': apiKey };
    const response = await axios.get(url, { headers, timeout: 5000 });
    return response.data.data;
  } catch (error) {
    throw new Error(`Failed to get BingX positions: ${error.message}`);
  }
}

async function getOrder(apiKey, apiSecret, symbol, orderId) {
  try {
    const timestamp = await getServerTime();
    const payload = {
      symbol,
      orderId: BigInt(orderId),
      timestamp,
    };
    const parameters = new URLSearchParams(payload).toString();
    const signature = CryptoJS.HmacSHA256(parameters, apiSecret).toString();
    const url = `${api.protocol}://${api.host}/openApi/swap/v2/trade/order?${parameters}&signature=${signature}`;
    const headers = { 'X-BX-APIKEY': apiKey };
    const response = await axios.get(url, { headers, timeout: 5000 });
    return response.data.data.order.status;
  } catch (error) {
    throw new Error(`Failed to get BingX order: ${error.message}`);
  }
}

async function getBalance(apiKey, apiSecret) {
  try {
    const timestamp = await getServerTime();
    const payload = { timestamp };
    const parameters = new URLSearchParams(payload).toString();
    const signature = CryptoJS.HmacSHA256(parameters, apiSecret).toString();
    const url = `${api.protocol}://${api.host}/openApi/swap/v2/user/balance?${parameters}&signature=${signature}`;
    const headers = { 'X-BX-APIKEY': apiKey };
    const response = await axios.get(url, { headers, timeout: 5000 });
    return response.data.data;
  } catch (error) {
    throw new Error(`Failed to get BingX balance: ${error.message}`);
  }
}

async function getOrders(apiKey, apiSecret, checkStatus = false) {
  try {
    const timestamp = await getServerTime();
    const payload = { timestamp };
    const parameters = new URLSearchParams(payload).toString();
    const signature = CryptoJS.HmacSHA256(parameters, apiSecret).toString();
    const url = `${api.protocol}://${api.host}/openApi/swap/v2/trade/openOrders?${parameters}&signature=${signature}`;
    const headers = { 'X-BX-APIKEY': apiKey };
    const response = await axios.get(url, { headers, timeout: 5000 });

    let orders = response.data.data.orders;
    if (!checkStatus) {
      orders = orders.filter(order => order.type === 'LIMIT');
    }
    return orders;
  } catch (error) {
    throw new Error(`Failed to get BingX open orders: ${error.message}`);
  }
}

module.exports = {
  getPositions,
  getOrder,
  getOrders,
  getBalance,
  getServerTime
};
