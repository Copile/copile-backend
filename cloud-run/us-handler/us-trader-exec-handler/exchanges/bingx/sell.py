from .bingX.perpetual.v2.Perpetual import Perpetual
import asyncio

async def sell_quantity(account_id, trade_id, quantity, trade_info, keys):
    symbol = trade_info["symbol"]
    side = trade_info["side"]

    client = Perpetual(api_key=keys["api_key"], api_secret=keys["api_secret"])
    
    position = await client.positions(
        symbol=symbol,
    )
    positionSide = position[0]["positionSide"]
    try:
        emergency = await client.trade_order(
            symbol=symbol,
            type="MARKET",
            side="SELL" if positionSide == "LONG" else "BUY",
            positionSide=positionSide,
            quantity=float(quantity)
        )
        return f"Executed partial close for {symbol} for {account_id}"
    except Exception as error:
        print(error)