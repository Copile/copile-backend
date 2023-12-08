from trade.trade_execution import trade_execution
import asyncio
import time
import logging

logging.basicConfig(level=logging.INFO)

bingx_api_key = "uKaQR7SNRwUqTqcf09G72B0Hk5ChvTD3aWzRNJ6VHHSfHwyBW25TJh5HHGCuY62GuDUaZ1sQSO0lVscAg"
bingx_api_secret = "Ssz3IWYyiDmUmE4l9DytiX6opbllCl3uZn6E9euMS28v2WLxXQMW74ywzgtdcHClBoNJKgkXHqIqSTaYmWQ"

bybit_api_key = "ZuhzXiG2TmZOASqM2T"
bybit_api_secret = "OQSn8YsDKfE3XShN3bgD68uWiOxblJdUGwRD"

binance_api_key = "9uEl3DDT5S0Ij5koFvkfQdSy5jJH2KQ2cjoUNZEHXdfNQ4qVak13CLuxSWCNCZ8z"
binance_api_secret = "6AevR0uy1RZeMNfrh12IPFC1IoTkfntvpGVwDHWD6wIdkT4H8ZYEtJQyCQqu5BRZ"

kucoin_api_key = "656e3f3d1ff1fd0001180d97"
kucoin_api_secret = "130d3c23-e4c9-4f89-8d92-e625a77475f8"
kucoin_api_passphrase = "niggerwtf"

body_bulk_order = {
    "traderId": "newfuckingacc",
    "tradeId": "4e568ae0-07d5-4251-962c-f4f13210bb17",
    "margin": 3.5,
    "trader_exchange": "kucoin",
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
                "tp_value": 0.52,
                "tp_percentage": 0.5
            },
            {
                "tp_id": "d4f68472-1da9-4e58-9c6a-080bdba8740f",
                "tp_number": 2,
                "tp_value": 0.50,
                "tp_percentage": 0.5
            }
        ],
        "stop_losses": [
            {
                "sl_id": "08471ed3-3904-4bcc-8424-b7f51f1fe0a4",
                "sl_number": '1',
                "sl_value": 0.63,
                "sl_percentage": 1
            }
        ]
    }
}

body_send_sl = {
    "traderId": "newfuckingacc",
    "tradeId": "4e568ae0-07d5-4251-962c-f4f13210bb17",
    "sl_id": "08471ed3-3904-4bcc-8424-b7f51f1fe0a4",
    "payload": {"sl_number": '1', "sl_value": '0.65', "sl_percentage": 1},
    "trader_exchange": "bybit"
}

body_replace_sl = {
    "traderId": "newfuckingacc",
    "tradeId": "4e568ae0-07d5-4251-962c-f4f13210bb17",
    "document_id": "08471ed3-3904-4bcc-8424-b7f51f1fe0a4",
    "payload": {"sl_number": '1', "sl_value": '0.63', "sl_percentage": 1},
    "trader_exchange": "bybit"

}

body_bulk_tp = {
    "traderId": "newfuckingacc",
    "tradeId": "4e568ae0-07d5-4251-962c-f4f13210bb17",
    "trader_exchange": "bybit",
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
    ]
}

body_close_all = {
    "traderId": "newfuckingacc",
    "tradeId": "4e568ae0-07d5-4251-962c-f4f13210bb17",
    "trader_exchange": "binance"
}

body_close_tps = {
    "traderId": "newfuckingacc",
    "tradeId": "4e568ae0-07d5-4251-962c-f4f13210bb17",
    "trader_exchange": "bybit"
}

body_cancel_order = {
    "traderId": "newfuckingacc",
    "tradeId": "4e568ae0-07d5-4251-962c-f4f13210bb17",
    "document_id": "08471ed3-3904-4bcc-8424-b7f51f1fe0a4",
    "trade_type": "sl",
    "trader_exchange": "bybit"
}

body_partial_close = {
    "traderId": "newfuckingacc",
    "tradeId": "4e568ae0-07d5-4251-962c-f4f13210bb17",
    "trader_exchange": "bybit",
    "percentage": 0.5
}


async def test():
    try:
        start_time = time.perf_counter()

        execution = await trade_execution(kucoin_api_key, kucoin_api_secret, kucoin_api_passphrase, "bulkOrder",
                                          body_bulk_order)

        end_time = time.perf_counter()

        elapsed_time = end_time - start_time
        logging.info(f'Execution time: {elapsed_time} seconds')

    except Exception as e:
        logging.error("An error occurred: %s", e, exc_info=True)


asyncio.run(test())
