import time
import asyncio
import MetaTrader5 as mt5
from ..scripts.order_factory import Order

async def bulk_order(login_id, password, server):
    try:
        # Create server connection to mt5
        mt5.initiliaze(login=login_id, server=server, password=password)

        print(mt5.terminal_info())
        print(mt5.version())



    except Exception as e:
        print(e)

