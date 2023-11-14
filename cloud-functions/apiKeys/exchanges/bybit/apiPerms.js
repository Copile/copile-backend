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
  if (queryApiKeyResponse.retCode !== 0) {
    return {
      success: false,
      code: 401,
      message: "An Error occured.",
    };
  }
  return {
    success: true,
    code: 200,
    data: queryApiKeyResponse.result,
  };
}

module.exports = { getBybitAPIPerms };
