const { RestClientV5 } = require("bybit-api");
const CustomError = require("../../utils/error");

async function getBybitAPIPerms(apiKey, apiSecret, isTestnet = false) {
  const client = new RestClientV5({
    key: apiKey,
    secret: apiSecret,
    strict_param_validation: true,
    testnet: isTestnet,
  });
  const queryApiKeyResponse = await client.getQueryApiKey();
  if (queryApiKeyResponse.ret_code !== 0) {
    console.log(queryApiKeyResponse);
    return {
      success: false,
      data: queryApiKeyResponse,
    };
  }
  return {
    success: true,
    data: queryApiKeyResponse,
  };
}

module.exports = { getBybitAPIPerms };
