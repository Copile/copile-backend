const CryptoJS = require("crypto-js");
const axios = require("axios");
const querystring = require("querystring");
const JSONbig = require('json-bigint')({ storeAsString: true });

const api = {
  host: "fapi.binance.com",
  protocol: "https",
};

// Common function to make signed request
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
      { headers, timeout: 1000 * 60 * 3 }
    );
    return response.data;
  } catch (error) {
    throw new Error(`Request to ${url} failed: ${error.message}`);
  }
}

async function getServerTime() {
  try {
    const url = `${api.protocol}://${api.host}/fapi/v1/time`;
    const response = await axios.get(url);
    return response.data.serverTime;
  } catch (error) {
    throw new Error(`Failed to get Binance server time: ${error.message}`);
  }
}

async function getPositions(apiKey, apiSecret) {
  try {
    const timestamp = await getServerTime();
    const url = `${api.protocol}://${api.host}/fapi/v2/positionRisk`;
    const payload = { timestamp, recvWindow: 5000 };
    const data = await makeSignedRequest(url, payload, apiKey, apiSecret);

    const positions = data.filter((pos) => parseFloat(pos.positionAmt) !== 0);
    return positions.map((pos) => ({
      ...pos,
      positionSide: parseFloat(pos.positionAmt) < 0 ? "SHORT" : "LONG",
    }));
  } catch (error) {
    throw new Error(`Failed to get Binance positions: ${error.message}`);
  }
}

async function getOrder(symbol, orderId, apiKey, apiSecret) {
  try {
    const timestamp = await getServerTime();
    const url = `${api.protocol}://${api.host}/fapi/v1/order`;
    const payload = { symbol, orderId, timestamp };
    const data = await makeSignedRequest(url, payload, apiKey, apiSecret);
    return data.status;
  } catch (error) {
    throw new Error(`Failed to get Binance order: ${error.message}`);
  }
}

async function getOrders(apiKey, apiSecret, checkStatus = false) {
  try {
    const timestamp = await getServerTime();
    const url = `${api.protocol}://${api.host}/fapi/v1/openOrders`;
    const payload = { timestamp, recvWindow: 5000 };
    const data = await makeSignedRequest(url, payload, apiKey, apiSecret);

    let orders = data;
    if (!checkStatus) {
      orders = orders.filter((order) => order.type === "LIMIT");
    }
    return orders.map((order) => ({
      ...order,
      orderId: JSONbig.parse(order.orderId)
    }));
  } catch (error) {
    throw new Error(`Failed to get Binance open orders: ${error.message}`);
  }
}

async function getBalance(apiKey, apiSecret) {
  try {
    const timestamp = await getServerTime();
    const url = `${api.protocol}://${api.host}/fapi/v2/balance`;
    const payload = { timestamp };
    const data = await makeSignedRequest(url, payload, apiKey, apiSecret);
    return data.filter((asset) => asset.asset === "USDT");
  } catch (error) {
    throw new Error(`Failed to get Binance balance: ${error.message}`);
  }
}

module.exports = {
  getPositions,
  getOrder,
  getOrders,
  getBalance,
};
