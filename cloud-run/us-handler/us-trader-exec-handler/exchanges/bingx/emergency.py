from .bingX.perpetual.v2.Perpetual import Perpetual
from .clear import clear_orders
from asyncio import gather

async def send_emergency(account_id, trade_id, trade_info, keys):
    symbol = trade_info["symbol"]
    order_id = trade_info["orderID"]
    
    client = Perpetual(api_key=keys["api_key"], api_secret=keys["api_secret"])

    position = await client.positions(
        symbol=symbol,
    )

    if position != []:
        try:
            quantity = position[0]["positionAmt"]
            positionSide = position[0]["positionSide"]

            emergency = await client.trade_order(
                symbol=symbol,
                type="MARKET",
                side="SELL" if positionSide == "LONG" else "BUY",
                positionSide=positionSide,
                quantity=quantity
            )
            await clear_orders(account_id, trade_id, trade_info, keys)
            return f"Stopped trade {symbol} for {account_id}"
        except Exception as error:
            print(error)
            
    else:
        try:
            cancel = await client.cancel_order(
                orderId=order_id,
                symbol=symbol
            )
            await clear_orders(account_id, trade_id, trade_info, keys)
            return f"Cancelled order ID: {str(order_id)} for {account_id}"
        except Exception as error:
            print(error)

