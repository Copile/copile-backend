const { getBalance } = require("./request");

async function getBinanceBalance(apiKey, apiSecret) {
  try {
    const balanceData = await getBalance(apiKey, apiSecret);
    const usdtBalance = balanceData.find((asset) => asset.asset === "USDT");
    return usdtBalance ? String(usdtBalance.availableBalance) : "0";
  } catch (e) {
    console.log("Error in getBinanceBalance: ", e);
    return [];
  }
}

module.exports = { getBinanceBalance };
