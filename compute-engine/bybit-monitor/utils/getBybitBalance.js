const { RestClientV5 } = require("bybit-api");
const CustomError = require('../firestore/error.js');

async function getBybitLeverage(symbol, apiKey, apiSecret, isTestnet = false) {
    console.log(symbol, apiKey, apiSecret, isTestnet)
    const client = new RestClientV5({
      key: apiKey,
      secret: apiSecret,
      strict_param_validation: true,
      testnet: isTestnet,
      recv_window: 5000,
    });
    let position = await client.getPositionInfo({"category": "linear", "symbol": symbol})
    let order = await client.getActiveOrders({"category": "linear", "settleCoin": "USDT"})
    console.log(leverage);
    let postionBalance = order.result.list[0].leavesValue
    let size = order.result.list[0].qty
    let price = order.result.list[0].price

    console.log("Price: " + price);
    console.log("Margin: " + postionBalance);
    console.log("Quantity: " + size);

}

getBybitLeverage("BTCUSDT", "8T6TM40BupN51NFtA6", "HhiC2Sa1Mt00S9Dzg9UtCeEuSRgXm7BMUxlB", true)

