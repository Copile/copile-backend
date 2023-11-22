from trade.trade_execution import trade_execution
import asyncio
import time
import logging

logging.basicConfig(level=logging.INFO)

api_key = "uKaQR7SNRwUqTqcf09G72B0Hk5ChvTD3aWzRNJ6VHHSfHwyBW25TJh5HHGCuY62GuDUaZ1sQSO0lVscAg"
api_secret = "Ssz3IWYyiDmUmE4l9DytiX6opbllCl3uZn6E9euMS28v2WLxXQMW74ywzgtdcHClBoNJKgkXHqIqSTaYmWQ"

body_bulk_order = {
    "traderId": "newfuckingacc",
    "tradeId": "4e568ae0-07d5-4251-962c-f4f13210bb17",
    "margin": 5,
    "trader_exchange": "bingx",
    "margin_type": "ISOLATED",
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
                "tp_value": 0.55,
                "tp_percentage": 0.5
            },
            {
                "tp_id": "d4f68472-1da9-4e58-9c6a-080bdba8740f",
                "tp_number": 2,
                "tp_value": 0.52,
                "tp_percentage": 0.5
            }
        ],
        "stop_losses": [
            {
                "sl_id": "9c070bc8-709f-4a64-a8d1-0d8c852bef44",
                "sl_number": 1,
                "sl_value": 0.62,
                "sl_percentage": 1
            }
        ]
    }
}

body_close_all = {
    "traderId": "newfuckingacc",
    "tradeId": "4e568ae0-07d5-4251-962c-f4f13210bb17",
    "trader_exchange": "bingx"
}

body_close_tps = {
    "traderId": "newfuckingacc",
    "tradeId": "4e568ae0-07d5-4251-962c-f4f13210bb17",
    "trader_exchange": "bingx"
}

body_cancel_order = {
    "traderId": "newfuckingacc",
    "tradeId": "4e568ae0-07d5-4251-962c-f4f13210bb17",
    "document_id": "85371c2c-addd-4cd6-844d-c955db11f3df",
    "trade_type": "tp",
    "trader_exchange": "bingx"
}


async def test():
    try:
        start_time = time.time()

        execution = await trade_execution(api_key, api_secret, None, "bulkOrder", body_bulk_order)

        end_time = time.time()

        elapsed_time = end_time - start_time
        logging.info('Execution time:', elapsed_time, 'seconds')

    except Exception as e:
        logging.error("An error occurred: %s", e, exc_info=True)

asyncio.run(test())
