import time
import asyncio
import MetaTrader5 as mt5
#from ..scripts.order_factory import Order

async def bulk_order(login_id, password, server, data):
    try:
        # Create server connection to mt5
        mt5.login(login=login_id, server=server, password=password)

        # Creating logger for info/errors
        #logger = Logger(user_id, trade_id)

        #logger.info(f"Starting bulk order with data: {data}")      

        symbol = "USDJPY"
        symbol_info = mt5.symbol_info(symbol)

        print(symbol_info)
        print(mt5.terminal_info())
        print(mt5.version())

        mt5.shutdown()

    except Exception as e:
        print(e)

asyncio.run(bulk_order(48078, "*164B)A5fDEH", "EvolveMarkets-MT5 Demo Server", "nothing"))