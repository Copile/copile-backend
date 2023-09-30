const { RestClientV5 } = require("bybit-api");
const CustomError = require("../../utils/error");

async function getTestnetBalance(apiKey, apiSecret) {
  try {
    const client = new RestClientV5({
      key: apiKey,
      secret: apiSecret,
      strict_param_validation: true,
      testnet: true,
    });
    const balance = await client.getAllCoinsBalance({
      accountType: "UNIFIED",
      coin: "USDT",
    });

    console.log("balance.result", balance.result);
    return balance.result.balance[0].walletBalance;
  } catch (e) {
    throw new CustomError({
      message: `Failed to fetch testnet balance: ${e.message}`,
      status: 500,
      source: "getTestnetBalance",
    });
  }
}

module.exports = { getTestnetBalance };
