const { makeSignedRequest } = require('./request.js')

async function contracts(
    apiKey, 
    apiSecret
  ) {
    const path = "/openApi/swap/v2/quote/contracts";
    const payload = {};
    return await makeSignedRequest("GET", path, payload, apiKey, apiSecret);
}

async function ticker(
    apiKey, 
    apiSecret,
    symbol
  ) {
    const path = "/openApi/swap/v2/quote/ticker";
    const payload = {symbol};
    return await makeSignedRequest("GET", path, payload, apiKey, apiSecret);
}

async function getOpenPositions(
    apiKey, 
    apiSecret,
    symbol
  ) {
    const path = "/openApi/swap/v2/user/positions";
    const payload = {symbol};
    return await makeSignedRequest("GET", path, payload, apiKey, apiSecret);
}

module.exports = {
    contracts,
    ticker,
    getOpenPositions,
}