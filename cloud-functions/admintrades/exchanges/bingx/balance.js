const getBalance = require("./request");

async function getBingXBalance(apiKey, apiSecret) {
    try {
      const balance = await getBalance(apiKey, apiSecret);
      return balance.data.data.balance.availableMargin;
    } catch (e) {
      console.log("Error in getBingXBalance: ", e);
      return [];
    }
  }

module.exports = { getBingXBalance };