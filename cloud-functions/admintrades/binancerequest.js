const CryptoJS = require("crypto-js");
const axios = require('axios');
const querystring = require('querystring');

const api = {
    host: "fapi.binance.com",
    protocol: "https",
};

// Generate Binance signature
function generateSignature(queryString, apiSecret) {
    return CryptoJS.HmacSHA256(queryString, apiSecret).toString(CryptoJS.enc.Hex);
}

// Similar to your previous timestamp generation function
async function getBinanceServerTime() {
    const url = `${api.protocol}://${api.host}/fapi/v1/time`;
    const response = await axios.get(url);
    return response.data.serverTime;
}

// Function to send a request to GET /fapi/v2/positionRisk
async function getPositionsBinance(apiKey, apiSecret) {
    try {
        const timestamp = await getBinanceServerTime();

        const payload = {
            timestamp: timestamp,
            recvWindow: 5000
        };

        const queryString = querystring.stringify(payload);
        const signature = generateSignature(queryString, apiSecret);

        const url = `${api.protocol}://${api.host}/fapi/v2/positionRisk?${queryString}&signature=${signature}`;

        const headers = {
            'X-MBX-APIKEY': apiKey,
        };

        const response = await axios.get(url, { headers, timeout: 1000 * 60 * 3 });

        // filter out positions with zero positionAmt
        response.data = response.data.filter((position) => {
            return parseFloat(position.positionAmt) !== 0;
        });

        // if there are no positions, return null
        if (response.data.length === 0) {
            console.log('No positions found');
            return null;
        }

        // if positionAmt is negative, then the position is short
        response.data = response.data.map((position) => {
            if (parseFloat(position.positionAmt) < 0) {
                position.positionSide = 'SHORT';
            } else {
                position.positionSide = 'LONG';
            }
            return position;
        }
        );
        return response.data;
    } catch (error) {
        console.error('An error occurred:', error.message);
        return null;
    }
}

async function getOrderBinance(symbol, orderId, apiKey, apiSecret) {
    try {
        const timestamp = await getBinanceServerTime();

        // Prepare the payload and parameters
        const payload = {
            symbol: symbol,
            orderId: orderId,
            timestamp: timestamp
        };
        const queryString = querystring.stringify(payload);
        const signature = generateSignature(queryString, apiSecret);

        const url = `${api.protocol}://${api.host}/fapi/v1/order?${queryString}&signature=${signature}`;

        const headers = {
            'X-MBX-APIKEY': apiKey,
        };

        const response = await axios.get(url, { headers, timeout: 1000 * 60 * 3 });
        return response.data.status;
    } catch (error) {
        console.log('An error occurred:', error);
        return null;
    }
}


// Function to send a request to GET /fapi/v1/openOrders
async function getOpenOrdersBinance(apiKey, apiSecret, checkStatus = false) {
    try {
        const timestamp = await getBinanceServerTime();

        // Prepare the payload and parameters
        const payload = {
            timestamp: timestamp,
            recvWindow: 5000
        };
        const queryString = querystring.stringify(payload);
        const signature = generateSignature(queryString, apiSecret);

        const url = `${api.protocol}://${api.host}/fapi/v1/openOrders?${queryString}&signature=${signature}`;

        const headers = {
            'X-MBX-APIKEY': apiKey,
        };

        const response = await axios.get(url, { headers, timeout: 1000 * 60 * 3 });

        let orders = response.data;
        if (!checkStatus) {
            // Filter the response to only include LIMIT order 
            orders = orders.filter((order) => {
                return order.type === 'LIMIT';
            });
        }
        return orders;
    } catch (error) {
        console.log('An error occurred:', error);
        return null;
    }
}

// Function to send a request to GET /fapi/v2/balance (HMAC SHA256)
async function getBalanceBinance(apiKey, apiSecret) {
    try {
        const timestamp = await getBinanceServerTime();

        const payload = {
            timestamp: timestamp,
        };

        const queryString = querystring.stringify(payload);
        const signature = generateSignature(queryString, apiSecret);

        const url = `${api.protocol}://${api.host}/fapi/v2/balance?${queryString}&signature=${signature}`;

        const headers = {
            'X-MBX-APIKEY': apiKey,
        };

        const response = await axios.get(url, { headers, timeout: 1000 * 60 * 3 });
        // only return USDT Balance
        response.data = response.data.filter((asset) => {
            return asset.asset === 'USDT';
        });

        return response.data;
    } catch (error) {
        console.error('An error occurred:', error.message);
        return null;
    }
}

module.exports = {
    getPositionsBinance,
    getOrderBinance,
    getOpenOrdersBinance,
    getBalanceBinance
};