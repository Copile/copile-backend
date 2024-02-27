import asyncio
import MetaTrader5 as mt5
from .api.perpetual import place_order, start_mt5, retrieve_latest_tick
from .scripts.settings import reformat_symbol, get_precision
from .utils.firestore import store_trade, store_sl, store_tp

async def cancel_all_tps(login_id, password, server, data):
    try:
        # Create server connection to mt5
        start_mt5(login_id, password, server)

        
    except Exception as e:
        print(e)
