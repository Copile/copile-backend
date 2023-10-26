require('dotenv').config({ path: '../.env' });
const CryptoJS = require("crypto-js");
const getParameters = require('./getParameters.js');
const axios = require('axios');
const API_KEY = process.env.API_KEY;
const API_SECRET = process.env.API_SECRET;
const HOST = process.env.BINGX_HOST;
const API = {
    "uri": "/openApi/user/auth/userDataStream",
    "method": "POST",
    "payload": {},
    "protocol": "https"
}

async function createListenKey() {
    const timestamp = new Date().getTime()
    const sign = CryptoJS.enc.Hex.stringify(CryptoJS.HmacSHA256(getParameters(API, timestamp), API_SECRET))
    const url = API.protocol+"://"+HOST+"?"+getParameters(API, timestamp, true)+"&signature="+sign
    const config = {
        method: API.method,
        url: url,
        headers: {
            'X-BX-APIKEY': API_KEY,
        },
        transformResponse: (resp) => {
            return resp;
        }
    };
    const resp = await axios(config);
    listenKey = JSON.parse(resp.data)["listenKey"]
    return listenKey
}

module.exports = createListenKey;