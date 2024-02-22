from api.perpetual import start_mt5, cancel_order, get_open_positions
from utils.firestore import get_trade_info
import asyncio
import MetaTrader5 as mt5

async def cancel_all_orders(login_id, password, server, data):
    try:
        # Create server connection to mt5
        start_mt5(login_id, password, server)

        trade_id = data['trade_id']
        account_id = data['account_id']
        trader_id = data['trader_id']

        #trade_info = await get_trade_info(trader_id, account_id, trade_id)
        #order_id = trade_info['orderID']
        #symbol = trade_info['symbol']

        print(mt5)

    except Exception as e:
        print(e)

asyncio.run(cancel_all_orders(48116, "3Aq^[^^!X£D1Qa3jd", "EvolveMarkets-MT5 Demo Server", data))