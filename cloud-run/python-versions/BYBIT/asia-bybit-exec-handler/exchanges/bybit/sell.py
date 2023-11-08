from .pybit.unified_trading import HTTP
import asyncio

async def sell_quantity(account_id, trade_id, quantity, trade_info, keys):
    symbol = trade_info["symbol"]
    side = trade_info["side"]

    # Connecting to Bybit API
    session = HTTP(
        testnet=False,
        api_key=keys["api_key"],
        api_secret=keys["api_secret"],
    )
    try:
        stop = await session.place_order(
            category="linear",
            side='Buy' if side == 'Sell' else 'Sell',
            symbol=symbol,
            orderType="Market",
            qty=float(quantity),
            timeInForce="GoodTillCancel",
            reduceOnly=True,
            closeOnTrigger=False,
        )
        return f"Executed partial close for {symbol} for {account_id}"
    except Exception as error:
        print(error)