from .binlib.um_futures import UMFutures
from ..firestore_functions import get_tp_sl_info, delete_tp_sl_order, delete_order, check_executed_status
from .clear import clear_orders
import asyncio

async def send_emergency(account_id, trade_id, trade_info, keys):
    try:
        symbol = trade_info['symbol']
        order_id = trade_info['orderID']
        side = trade_info['side']

        client = UMFutures(key=keys['api_key'], secret=keys['api_secret'])

        position = await client.get_position_risk(symbol=symbol)
        position_amount = abs(float(position[0]['positionAmt']))
        if float(position_amount) > 0:
            sell = await client.new_order(
                symbol=symbol,
                side="SELL" if side == "Buy" else "BUY",
                type="MARKET",
                quantity=float(position_amount),
                reduceOnly=True,
            )
        else:
            cancel = await client.cancel_order(
                symbol=symbol,
                orderId=int(order_id)
            )
        await clear_orders(account_id, trade_id, trade_info, keys)
        return f"Stopped trade {symbol} for {account_id}"
    except Exception as error:
        print(error)