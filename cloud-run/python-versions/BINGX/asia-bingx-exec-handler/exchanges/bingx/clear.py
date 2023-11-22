from .bingX.perpetual.v2.Perpetual import Perpetual
from ..firestore_functions import get_tp_sl_orders, change_executed_status_tp_sl, change_executed_status_tp_sl, delete_tp_sl_order
import asyncio

async def clear_orders(account_id, trade_id, trade_info, keys):
    try:
        tp_sl_orders = await get_tp_sl_orders(account_id, trade_id)
        symbol = trade_info["symbol"]
        
        if not tp_sl_orders:
            return f"No TP/SL orders to clear for {account_id} - {trade_id}"
        
        client = Perpetual(api_key=keys["api_key"], api_secret=keys["api_secret"])

        tp_sl_orders_not_active = [order for order in tp_sl_orders if order["executed"] == "0"]
        tp_sl_orders_active = [order for order in tp_sl_orders if order["executed"] == "1"]

        await asyncio.gather(
            *[change_executed_status_tp_sl(account_id, trade_id, order['document_id'], order['trade_type'], "2") for order in tp_sl_orders_not_active]
        )

        if len(tp_sl_orders_active) > 1:
            order_ids = [int(order['orderID']) for order in tp_sl_orders_active]

            await client.cancel_orders(
                symbol=symbol,
                orderIdList=order_ids
            )
            
            await asyncio.gather(
                *[delete_tp_sl_order(account_id, trade_id, order['document_id'], order['trade_type']) for order in tp_sl_orders_active]
            )
        elif len(tp_sl_orders_active) == 1:
            orderID = tp_sl_orders_active[0]["orderID"]

            await client.cancel_order(
                symbol=symbol,
                orderId=int(orderID)
            )
            await delete_tp_sl_order(account_id, trade_id, tp_sl_orders_active[0]["document_id"], tp_sl_orders_active[0]["trade_type"])
    except Exception as error:
        print(error)

async def clear_tps_sls(account_id, trade_id, type, trade_info, keys):
    try:
        tp_sl_orders = await get_tp_sl_orders(account_id, trade_id)
        symbol = trade_info["symbol"]
        
        if not tp_sl_orders:
            return f"No TP/SL orders to clear for {account_id} - {trade_id}"
        
        client = Perpetual(api_key=keys["api_key"], api_secret=keys["api_secret"])

        tp_sl_orders_not_active = [order for order in tp_sl_orders if order["executed"] == "0" and f"{type}_value" in order]
        tp_sl_orders_active = [order for order in tp_sl_orders if order["executed"] == "1" and f"{type}_value" in order]
        print(tp_sl_orders_active)
        print(tp_sl_orders_not_active)

        await asyncio.gather(
            *[change_executed_status_tp_sl(account_id, trade_id, order['document_id'], order['trade_type'], "2") for order in tp_sl_orders_not_active]
        )

        if len(tp_sl_orders_active) > 1:
            order_ids = [int(order['orderID']) for order in tp_sl_orders_active]

            await client.cancel_orders(
                symbol=symbol,
                orderIdList=order_ids
            )
            
            await asyncio.gather(
                *[delete_tp_sl_order(account_id, trade_id, order['document_id'], order['trade_type']) for order in tp_sl_orders_active]
            )
        elif len(tp_sl_orders_active) == 1:
            orderID = tp_sl_orders_active[0]["orderID"]

            await client.cancel_order(
                symbol=symbol,
                orderId=int(orderID)
            )
            await delete_tp_sl_order(account_id, trade_id, tp_sl_orders_active[0]["document_id"], tp_sl_orders_active[0]["trade_type"])
    except Exception as error:
        print(error)