from .binlib.um_futures import UMFutures
import asyncio

async def get_position(account_id, trade_if, trade_info, keys):
    try:
        symbol = trade_info['symbol']

        client = UMFutures(key=keys['api_key'], secret=keys['api_secret'])

        position = await client.get_position_risk(symbol=symbol)
        quantity = position[0]['positionAmt']

        if float(quantity) != 0:
            return abs(float(quantity))
        else:
            return 0
    except Exception as error:
        print(error)