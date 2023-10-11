from .binlib.um_futures import UMFutures
import asyncio

async def sell_quantity(account_id, trade_id, quantity, trade_info, keys):
    try:
        symbol = trade_info['symbol']
        side = trade_info['side']

        client = UMFutures(key=keys['api_key'], secret=keys['api_secret'])

        sell = await client.new_order(
            symbol=symbol,
            side="SELL" if side == "Buy" else "BUY",
            type="MARKET",
            quantity=quantity,
            reduceOnly=True,
        )
        return f"Executed partial close for {symbol} for {account_id}"
    except Exception as error:
        print(error)