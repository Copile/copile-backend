import asyncio
import MetaTrader5 as mt5
from api.perpetual import place_order, start_mt5, retrieve_latest_tick
from scripts.settings import reformat_symbol, get_precision
from utils.firestore import get_trade_info, store_tp

data = {
    'take_profits': [
        {
            "tp_id": "2131231",
            "tp_value": 3200,
            "tp_percentage": 0.5
        },
        {
            "tp_id": "1232131",
            "tp_value": 3400,
            "tp_percentage": 0.5
        }
    ]
}

async def bulk_tp(login_id, password, server, data):
    try:
        # Create server connection to mt5
        start_mt5(login_id, password, server)

        # Fetching the trade info from firestore
        # trade_info = await get_trade_info(user_id, trade_id)
        # symbol = trade_info["symbol"]
        # side = trade_info["side"]
        # leverage = trade_info["leverage"]

        # precision = get_precision(symbol)
        


        
    except Exception as e:
        print(e)
