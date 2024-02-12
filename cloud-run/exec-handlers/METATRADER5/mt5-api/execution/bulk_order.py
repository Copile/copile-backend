import time
import asyncio
import MetaTrader5 as mt5
#from ..scripts.order_factory import Order

async def bulk_order(login_id, password, server):
    try:
        # Create server connection to mt5
        mt5.initialize(login=login_id, server=server, password=password)

        symbol = "USDJPY"
        symbol_info = mt5.symbol_info(symbol)

        print(mt5.terminal_info())
        print(mt5.version())

        mt5.shutdown()

    except Exception as e:
        print(e)

asyncio.run(bulk_order(79099544, "A-RtFf7b", "MetaQuotes-Demo"))