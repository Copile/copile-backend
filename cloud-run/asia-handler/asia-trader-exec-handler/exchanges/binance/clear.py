from .binlib.um_futures import UMFutures
from ..firestore_functions import get_tp_sl_orders, change_executed_status_tp_sl, delete_tp_sl_order, change_executed_status_tp_sl
import asyncio

async def clear_orders(account_id, trade_id, trade_info, keys):
    try:
        tp_sl_orders = await get_tp_sl_orders(account_id, trade_id)
        symbol = trade_info["symbol"]
        
        if not tp_sl_orders:
            return f"No TP/SL orders to clear for {account_id} - {trade_id}"
        
        client = UMFutures(key=keys['api_key'], secret=keys['api_secret'])

        tp_sl_orders_not_active = [order for order in tp_sl_orders if order["executed"] == 0]
        tp_sl_orders_active = [order for order in tp_sl_orders if order["executed"] != 0]
        print(tp_sl_orders_active)
        print(tp_sl_orders_not_active)

        await asyncio.gather(
            *[change_executed_status_tp_sl(account_id, trade_id, order['document_id'], order['trade_type']) for order in tp_sl_orders_not_active]
        )

        if len(tp_sl_orders_active) > 1:
            order_ids = [int(order['orderID']) for order in tp_sl_orders_active]

            cancel_batch = await client.cancel_batch_order(
                symbol=symbol,
                orderIdList=order_ids,
                origClientOrderIdList=None
            )
            
            await asyncio.gather(
                *[change_executed_status_tp_sl(account_id, trade_id, order['document_id'], order['trade_type']) for order in tp_sl_orders_active]
            )
        else:
            orderID = tp_sl_orders_active[0]["orderID"]

            cancel = await client.cancel_order(
                symbol=symbol,
                orderId=orderID
            )
            await change_executed_status_tp_sl(account_id, trade_id, tp_sl_orders_active[0]["document_id"], tp_sl_orders_active[0]["trade_type"])
    except Exception as error:
        print(error)