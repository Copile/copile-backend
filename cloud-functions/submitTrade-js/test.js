const tradeExecution = require('./trade/tradeExecution');

const apiKey = "uKaQR7SNRwUqTqcf09G72B0Hk5ChvTD3aWzRNJ6VHHSfHwyBW25TJh5HHGCuY62GuDUaZ1sQSO0lVscAg"
const apiSecret = "Ssz3IWYyiDmUmE4l9DytiX6opbllCl3uZn6E9euMS28v2WLxXQMW74ywzgtdcHClBoNJKgkXHqIqSTaYmWQ"

let bodyBulkOrder = {
    "traderId": "newfuckingacc",
    "tradeId": "4e568ae0-07d5-4251-962c-f4f13210bb17",
    "margin": 5,
    "trader_exchange": "bingx",
    "marginType": "ISOLATED",
    "exchanges": [
        "bybit",
    ],
    "plans": [],
    "payload": {
        "side": "Sell",
        "symbol": "XRPUSDT",
        "leverage": "5",
        "entry": "market",
        "take_profits": [
            {
                "tp_id": "85371c2c-addd-4cd6-844d-c955db11f3df",
                "tp_number": 1,
                "tp_value": 0.61,
                "tp_percentage": 0.25
            },
            {
                "tp_id": "d4f68472-1da9-4e58-9c6a-080bdba8740f",
                "tp_number": 2,
                "tp_value": 0.60,
                "tp_percentage": 0.25
            },
            {
                "tp_id": "4d8367d2-bc8d-467a-8f42-5f1d7ce83930",
                "tp_number": 2,
                "tp_value": 0.58,
                "tp_percentage": 0.25
            },
            {
                "tp_id": "4c27ab73-f053-479c-b518-58653e8ad2b6",
                "tp_number": 2,
                "tp_value": 0.55,
                "tp_percentage": 0.25
            },
        ],
        "stop_losses": [
            {
                "sl_id": "9c070bc8-709f-4a64-a8d1-0d8c852bef44",
                "sl_number": 1,
                "sl_value": 0.66,
                "sl_percentage": 1
            }
        ]
    }
}

let bodyCloseAll = {
    "traderId": "newfuckingacc",
    "tradeId": "4e568ae0-07d5-4251-962c-f4f13210bb17",
    "trader_exchange": "bingx"
}

let bodyCloseTps = {
    "traderId": "newfuckingacc",
    "tradeId": "4e568ae0-07d5-4251-962c-f4f13210bb17",
    "trader_exchange": "bingx"
}

let bodyCancelOrder = {
    "traderId": "newfuckingacc",
    "tradeId": "4e568ae0-07d5-4251-962c-f4f13210bb17",
    "document_id": "85371c2c-addd-4cd6-844d-c955db11f3df",
    "trade_type": "tp",
    "trader_exchange": "bingx"
}

async function testFunction() {
    try {
        console.log("------ TEST CASE ------");

        console.time("Execution Time");
        let execution = await tradeExecution(apiKey, apiSecret, null, "cancelOrder", bodyCancelOrder);
        console.timeEnd("Execution Time");

    } catch (error) {
        console.error("Error during trade execution:", error);
    }
}

testFunction();