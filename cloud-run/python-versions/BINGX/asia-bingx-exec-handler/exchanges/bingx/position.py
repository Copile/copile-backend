from .bingX.perpetual.v2.Perpetual import Perpetual
import asyncio

async def get_position(account_id, trade_id, trade_info, keys):
    symbol = trade_info["symbol"]

    client = Perpetual(api_key=keys["api_key"], api_secret=keys["api_secret"])

    position = await client.positions(
        symbol=symbol,
    )
    if position != []:
        return abs(float(position[0]['positionAmt']))
    else:
        return 0
