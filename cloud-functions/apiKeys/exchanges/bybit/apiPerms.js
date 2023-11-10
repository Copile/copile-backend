const { RestClientV5 } = require("bybit-api");
const CustomError = require("../../utils/error");

async function getBybitAPIPerms(apiKey, apiSecret) {
  try {
    const client = new RestClientV5({
      key: apiKey,
      secret: apiSecret,
      strict_param_validation: true,
    });
    const response = await client.getQueryApiKey();

    return response;
  } catch (e) {
    throw new CustomError({
      message: `Failed to fetch bybit balance: ${e.message}`,
      status: 500,
      source: "getBybitAPIPerms",
    });
  }
}

module.exports = { getBybitAPIPerms };
