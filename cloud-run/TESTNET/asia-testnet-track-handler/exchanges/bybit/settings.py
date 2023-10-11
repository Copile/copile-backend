from .pybit.unified_trading import HTTP
import asyncio

async def change_partial_mode(symbol, keys):
    try:
        session = HTTP(
            testnet=True,
            api_key=keys["api_key"],
            api_secret=keys["api_secret"],
        )
        partial_mode = await session.set_tp_sl_mode(
            symbol=symbol,
            tpSlMode="Partial"
        )
        return partial_mode
    except Exception as error:
        return "Changed"    