from pybit.unified_trading import HTTP
import asyncio

async def get_precision(account_id, symbol, keys):

    # Connecting to Bybit API
    session = HTTP(
        testnet=False,
        api_key=keys["api_key"],
        api_secret=keys["api_secret"],
    )

    coin_info = session.get_instruments_info(category="linear", symbol=symbol)['result']['list'][0]
    quantity_precision = 0 if float(coin_info["lotSizeFilter"]["qtyStep"]).is_integer() else int(len(str(coin_info["lotSizeFilter"]["qtyStep"]).split(".")[1]))
    return quantity_precision