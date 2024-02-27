import asyncio
from metaapi_cloud_sdk import MetaApi
from scripts.settings import reformat_symbol, get_precisions, retrieve_latest_tick
from utils.firestore import store_trade, store_sl, store_tp

to_use = 'eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI5NDBhODc2YzJkMGZiOTdkOWYwOGQ1OGRhN2Q4M2JjNyIsInBlcm1pc3Npb25zIjpbXSwiYWNjZXNzUnVsZXMiOlt7ImlkIjoidHJhZGluZy1hY2NvdW50LW1hbmFnZW1lbnQtYXBpIiwibWV0aG9kcyI6WyJ0cmFkaW5nLWFjY291bnQtbWFuYWdlbWVudC1hcGk6cmVzdDpwdWJsaWM6KjoqIl0sInJvbGVzIjpbInJlYWRlciIsIndyaXRlciJdLCJyZXNvdXJjZXMiOlsiKjokVVNFUl9JRCQ6KiJdfSx7ImlkIjoibWV0YWFwaS1yZXN0LWFwaSIsIm1ldGhvZHMiOlsibWV0YWFwaS1hcGk6cmVzdDpwdWJsaWM6KjoqIl0sInJvbGVzIjpbInJlYWRlciIsIndyaXRlciJdLCJyZXNvdXJjZXMiOlsiKjokVVNFUl9JRCQ6KiJdfSx7ImlkIjoibWV0YWFwaS1ycGMtYXBpIiwibWV0aG9kcyI6WyJtZXRhYXBpLWFwaTp3czpwdWJsaWM6KjoqIl0sInJvbGVzIjpbInJlYWRlciIsIndyaXRlciJdLCJyZXNvdXJjZXMiOlsiKjokVVNFUl9JRCQ6KiJdfSx7ImlkIjoibWV0YWFwaS1yZWFsLXRpbWUtc3RyZWFtaW5nLWFwaSIsIm1ldGhvZHMiOlsibWV0YWFwaS1hcGk6d3M6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFzdGF0cy1hcGkiLCJtZXRob2RzIjpbIm1ldGFzdGF0cy1hcGk6cmVzdDpwdWJsaWM6KjoqIl0sInJvbGVzIjpbInJlYWRlciJdLCJyZXNvdXJjZXMiOlsiKjokVVNFUl9JRCQ6KiJdfSx7ImlkIjoicmlzay1tYW5hZ2VtZW50LWFwaSIsIm1ldGhvZHMiOlsicmlzay1tYW5hZ2VtZW50LWFwaTpyZXN0OnB1YmxpYzoqOioiXSwicm9sZXMiOlsicmVhZGVyIiwid3JpdGVyIl0sInJlc291cmNlcyI6WyIqOiRVU0VSX0lEJDoqIl19LHsiaWQiOiJjb3B5ZmFjdG9yeS1hcGkiLCJtZXRob2RzIjpbImNvcHlmYWN0b3J5LWFwaTpyZXN0OnB1YmxpYzoqOioiXSwicm9sZXMiOlsicmVhZGVyIiwid3JpdGVyIl0sInJlc291cmNlcyI6WyIqOiRVU0VSX0lEJDoqIl19LHsiaWQiOiJtdC1tYW5hZ2VyLWFwaSIsIm1ldGhvZHMiOlsibXQtbWFuYWdlci1hcGk6cmVzdDpkZWFsaW5nOio6KiIsIm10LW1hbmFnZXItYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6ImJpbGxpbmctYXBpIiwibWV0aG9kcyI6WyJiaWxsaW5nLWFwaTpyZXN0OnB1YmxpYzoqOioiXSwicm9sZXMiOlsicmVhZGVyIl0sInJlc291cmNlcyI6WyIqOiRVU0VSX0lEJDoqIl19XSwidG9rZW5JZCI6IjIwMjEwMjEzIiwiaW1wZXJzb25hdGVkIjpmYWxzZSwicmVhbFVzZXJJZCI6Ijk0MGE4NzZjMmQwZmI5N2Q5ZjA4ZDU4ZGE3ZDgzYmM3IiwiaWF0IjoxNzA5MDU1OTc3LCJleHAiOjE3MTY4MzE5Nzd9.ThLvJfKcUsjWiu5W-u7xBzKHCqAVv9DjhW9SeIZ6hcOR7jcvfde4NZRbzQVFrE2nF3lnQ5OGB0CBY2dsnf1y_9okiQMM3ScGPPocqGcmbhiiQk2_5xQv3el-ylLdF8ACG9DHD9rJu0Jg5VfioKaXFYC7tQgCXGRjRscg0kiTI6WFjk7BlfchFomp0QC4pnY2AXAnEo9w8RYkcIiD2WwdqykCPbSng0e9hJW7DgRSujU4xaxhWSHzcw2_dd8s8yLhX5q3WoLqH6n9KummD6Xxq-3w3_HOKsLK1FdK_a10yFt7MSTXfht1whhGCkbeU5CJth3n11LgklmCIQsruZtG0Bho8Z4_sBBXyhbQuJYfjQiNdE41dLpKZ5oTkKcAftFFLALqYygg3nXvMGtLtAuGrFibksuUQ4mi5L-MIgLj3rZzh1E_4yWYACLbjkt1UtWaM7IZLhfeQ06GLdPXobu95oe195h9_PivpqPki3HmtcRnbsvvbgO00sA0AK04OHwntTSnrFcK_2vMxWmOWFb2sFwBsNzq7r7MR9PtzMQ_JIUqhvQigyKb5k5qEi0ucfuqvGFg0PNmEfI7MxmEvOmMffLbJWwAZz_W61txjH4zdFpmxdvr69v5F8C7bUw6GPXJynC7mqWbA7MHLu_qHRMgtgGEfcK55mhW8TsQ_76eGF8'
account_to = '7d9c66a1-b033-4a8f-b611-fc7d96402fdb'

data = {
    "trade_id": "bastardtrade123",
    "account_id": "bastardmt5",
    "trader_id": "bastardtrader",
    "trader_percentage": 0.05,
    "trader_leverage": 20,
    "payload": {
        "side": "BUY",
        "entry": 3200,
        "symbol": "ETHUSDT",
        "take_profits": [
            {
                "tp_id": "1231231312",
                "tp_value": 3700,
                "tp_percentage": 1.0
            }
        ],
        "stop_losses": [
            {
                "sl_id": "123012031",
                "sl_value": 3000,
                "sl_percentage": 1.0
            }
        ]
    }
}

async def bulk_order(token, meta_id, data):
    try:
        # Connect to MetaApi
        api = MetaApi(token)

        trade_id = data['trade_id']
        account_id = data['account_id']
        trader_id = data['trader_id']
        trader_percentage = data['trader_percentage']
        trader_leverage = data['trader_leverage']

        side = data['payload']['side'].upper()
        entry = data['payload']['entry']
        stop_losses = data['payload']['stop_losses']
        take_profits = data['payload']['take_profits']

        symbol = reformat_symbol(data['payload']['symbol'])

        # Get meta Account
        account = await api.metatrader_account_api.get_account(meta_id)

        # Wait until account is deployed and connected to broker
        print('Waiting for API server to connect to broker (may take couple of minutes)')
        await account.wait_connected()

        # Connect to MetaApi API
        connection = account.get_streaming_connection()
        await connection.connect()

        # Wait until terminal state synchronized to the local state
        print('Waiting for SDK to synchronize to terminal state (may take some time depending on your history size)')
        await connection.wait_synchronized({'timeoutInSeconds': 600})

        terminal_state = connection.terminal_state

        margin = round(float(terminal_state.account_information["freeMargin"]) * trader_percentage, 2)

        # Fetching precision for specific symbol
        precision = get_precisions(terminal_state, symbol)
        price_precision = precision['price_precision']
        quantity_precision = precision['quantity_precision']
        
        # Fetching current market price for specific symbol
        market_price = retrieve_latest_tick(terminal_state, symbol)

        quantity = round(((margin * 100) * (trader_leverage / 100)) / market_price, quantity_precision)
        print(quantity)
        stop_loss_price = float(round(stop_losses[0]['sl_value'] if stop_losses != [] else None, price_precision)) 
        take_profit_price = float(round(take_profits[0]['tp_value'] if take_profits != [] else None, price_precision))

        if entry != 'market':
            if side == "BUY":
                initial_order = await connection.create_market_buy_order(
                    symbol=symbol, volume=quantity, stop_loss=stop_loss_price, take_profit=take_profit_price
                )
            else:
                initial_order = await connection.create_market_sell_order(
                    symbol=symbol, volume=quantity, stop_loss=stop_loss_price, take_profit=take_profit_price
                )
        else:
            if side == "BUY":
                initial_order = await connection.create_limit_buy_order(
                    symbol=symbol, volume=quantity, open_price=round(float(entry), price_precision), stop_loss=stop_loss_price, take_profit=take_profit_price
                )
            else:
                initial_order = await connection.create_limit_sell_order(
                    symbol=symbol, volume=quantity, open_price=round(float(entry), price_precision), stop_loss=stop_loss_price, take_profit=take_profit_price
                )

        trade_info = {
            "trade_id": trade_id,
            "order_id": initial_order['orderId'],
            "symbol": symbol,
            "type": "market" if entry == 'market' else "limit",
            "side": side,
            "quantity": quantity,
            "entry": entry if entry != 'market' else market_price,
            "leverage": 0,
            "margin": margin,
            "exchange": "MT5"
        }

        await store_trade(trader_id, account_id, trade_info)

        tp_dict = {
            "order_id": 0,
            "tp_number": 1,
            "tp_value": take_profit_price,
            "tp_percentage": 1,
            "tp_amount": 1
        }

        sl_dict = {
            "order_id": 0,
            "sl_number": 1,
            "sl_value": stop_loss_price,
            "sl_percentage": 1,
            "sl_amount": 1
        }

        await asyncio.gather(
            store_tp(trader_id, account_id, tp_dict),
            store_sl(trader_id, account_id, sl_dict)
        )

    except Exception as e:
        print(e)

asyncio.run(bulk_order(to_use, account_to, data))