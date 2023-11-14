from .pybit.unified_trading import HTTP

async def get_position(account_id, trade_id, trade_info, keys):
    symbol = trade_info["symbol"]

    # Connecting to Bybit API
    session = HTTP(
        testnet=True,
        api_key=keys["api_key"],
        api_secret=keys["api_secret"],
    )
    fetch = await session.get_positions(category="linear", symbol=symbol)
    position = fetch['result']['list'][0]
    if float(position['size']) != 0:
        return abs(float(position['size']))
    else:
        return 0