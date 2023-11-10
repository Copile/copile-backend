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
    const response = await client.getAllCoinsBalance({
      accountType: "UNIFIED",
      coin: "USDT",
    });
    if (
      !response ||
      !response.result ||
      !response.result.balance ||
      !response.result.balance.length
    )
      return;
    balance = response.result.balance.find((coin) => coin.coin === "USDT");
    if (!balance) return;
    
    return balance.walletBalance;
  } catch (e) {
    throw new CustomError({
      message: `Failed to fetch testnet balance: ${e.message}`,
      status: 500,
      source: "getTestnetBalance",
    });
  }
}

module.exports = { getTestnetBalance };
