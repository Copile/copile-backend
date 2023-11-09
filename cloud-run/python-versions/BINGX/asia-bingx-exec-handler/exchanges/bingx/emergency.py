from .bingX.perpetual.v2.Perpetual import Perpetual
from .clear import clear_orders

async def send_emergency(account_id, trade_id, trade_info, keys):
    try:
        symbol = trade_info["symbol"]
        order_id = trade_info["orderID"]
        
        client = Perpetual(api_key=keys["api_key"], api_secret=keys["api_secret"])

        position = await client.positions(
            symbol=symbol,
        )
        
        if position != []:
            quantity = position[0]["positionAmt"]
            positionSide = position[0]["positionSide"]
            await client.trade_order(
                symbol=symbol,
                type="MARKET",
                side="SELL" if positionSide == "LONG" else "BUY",
                positionSide=positionSide,
                quantity=quantity
            )
            await clear_orders(account_id, trade_id, trade_info, keys)
            return f"Stopped trade {symbol} for {account_id}"
                
        else:
            await client.cancel_order(
                orderId=int(order_id),
                symbol=symbol
            )
            await clear_orders(account_id, trade_id, trade_info, keys)
            return f"Cancelled order ID: {str(order_id)} for {account_id}"
    except Exception as error:
        raise Exception(f"Error submitting emergency order for {account_id}: {error}")
