import MetaTrader5 as mt5
import asyncio
from api.perpetual import start_mt5, modify_position
from utils.firestore import get_trade_info

async def send_sl(login_id, password, server, data):
    try:
        start_mt5(login_id, password, server)

        #trade_id = data['trade_id']
        #account_id = data['account_id']

        # Fetching the trade info from firestore
        #trade_info = await get_trade_info(account_id, trade_id)
        #symbol = trade_info['symbol']
        #order_id = trade_info['orderID']
        #side = trade_info['side']
        #leverage = trade_info['leverage']

        #sl_side = "SELL" if side == "BUY" else "BUY"
        
        modification = modify_position()

    except Exception as e:
        print(e)

asyncio.run(send_sl("test", "test", "test", "test"))        
