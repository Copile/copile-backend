from .binlib.um_futures import UMFutures
import asyncio

async def get_precision(account_id, symbol, keys):
    try:
        client = UMFutures(key=keys['api_key'], secret=keys['api_secret'])
        symbol_info = await client.exchange_info()
        precision = symbol_info['symbols']
        
        return precision
    except Exception as error:
        print(error)

async def get_quantity_precision(account_id, symbol, keys):
    try:
        client = UMFutures(key=keys['api_key'], secret=keys['api_secret'])

        symbol_info = await client.exchange_info()
        symbols = symbol_info['symbols']

        for i in range(len(symbols)):
            if symbols[i]['symbol'] == symbol:
                quantityPrecision = symbols[i]['quantityPrecision']
                return quantityPrecision
    except Exception as error:
        print(error)