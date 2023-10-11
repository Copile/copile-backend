from .binlib.um_futures import UMFutures
import asyncio

async def change_margin_type(symbol, keys):
    try:    
        client = UMFutures(key=keys['api_key'], secret=keys['api_secret'])
        await client.change_margin_type(symbol=symbol, marginType="ISOLATED")
        return "Changed"  
    except Exception as error:
        return "Changed"
    
async def change_leverage(symbol, leverage, keys):
    try:
        client = UMFutures(key=keys['api_key'], secret=keys['api_secret'])
        await client.change_leverage(symbol=symbol, leverage=int(leverage))
        return "Changed"
    except Exception as error:
        print(error)

async def get_market(symbol, keys):
    try:
        client = UMFutures(key=keys['api_key'], secret=keys['api_secret'])
        fetch = await client.ticker_price(symbol=symbol)
        return fetch["price"]
    except Exception as error:
        print(error)