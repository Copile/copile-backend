import time
import asyncio
import MetaTrader5 as mt5
from ..api.perpetual import place_order
#from ..scripts.order_factory import Order

async def bulk_order(login_id, password, server, data):
    try:
        # Create server connection to mt5
        mt5.initialize(login=login_id, server=server, password=password)

        # Creating logger for info/errors
        #logger = Logger(user_id, trade_id)

        #logger.info(f"Starting bulk order with data: {data}")      

        symbol = "BTCUSD"
        symbol_info = mt5.symbol_info(symbol)

        print(symbol_info)

        mt5.shutdown()

    except Exception as e:
        print(e)

asyncio.run(bulk_order(48116, "3Aq^[^^!X£D1Qa3jd", "EvolveMarkets-MT5 Demo Server", "nothing"))