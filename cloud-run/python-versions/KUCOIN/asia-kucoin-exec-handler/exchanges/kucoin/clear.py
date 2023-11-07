from .kuclib.client import Trade
from ..firestore_functions import get_tp_sl_orders, change_executed_status_tp_sl, delete_tp_sl_order, change_executed_status_tp_sl
import asyncio

async def clear_orders(account_id, trade_id, trade_info, keys):
    try:
        tp_sl_orders = await get_tp_sl_orders(account_id, trade_id)
        symbol = trade_info["symbol"]
        
        if not tp_sl_orders:
            return f"No TP/SL orders to clear for {account_id} - {trade_id}"
        
        client_trade = Trade(key=keys['api_key'], secret=keys['api_secret'], passphrase=keys['api_passphrase'],
                         is_sandbox=False, url='')

        tp_sl_orders_not_active = [order for order in tp_sl_orders if order["executed"] == "0" or order["executed"] == "3"]
        tp_sl_orders_active = [order for order in tp_sl_orders if order["executed"] == "1"]

        await asyncio.gather(
            *[change_executed_status_tp_sl(account_id, trade_id, order['document_id'], order['trade_type'], "2") for order in tp_sl_orders_not_active]
        )

        if len(tp_sl_orders_active) > 1:

            test = await client_trade.cancel_all_orders(
                symbol=symbol,
            )
            print(test)
            await asyncio.gather(
                *[delete_tp_sl_order(account_id, trade_id, order['document_id'], order['trade_type']) for order in tp_sl_orders_active]
            )
        elif len(tp_sl_orders_active) == 1:
            orderID = tp_sl_orders_active[0]["orderID"]

            await client_trade.cancel_order(
                orderId=str(orderID),
            )
            await delete_tp_sl_order(account_id, trade_id, tp_sl_orders_active[0]["document_id"], tp_sl_orders_active[0]["trade_type"])
        return
    except Exception as error:
        print(error)

async def clear_tps_sls(account_id, trade_id, type, trade_info, keys):
    try:
        tp_sl_orders = await get_tp_sl_orders(account_id, trade_id)
        symbol = trade_info["symbol"]
        
        if not tp_sl_orders:
            return f"No TP/SL orders to clear for {account_id} - {trade_id}"
        
        client_trade = Trade(key=keys['api_key'], secret=keys['api_secret'], passphrase=keys['api_passphrase'],
                         is_sandbox=False, url='')

        tp_sl_orders_not_active = [order for order in tp_sl_orders if order["executed"] == "0" or order["executed"] == "3" and f"{type}_value" in order]
        tp_sl_orders_active = [order for order in tp_sl_orders if order["executed"] == "1" and f"{type}_value" in order]

        await asyncio.gather(
            *[change_executed_status_tp_sl(account_id, trade_id, order['document_id'], order['trade_type'], "2") for order in tp_sl_orders_not_active]
        )

        tasks = []

        async def process_order(tp_sl_info):
            nonlocal tasks
            
            order_id = tp_sl_info["orderID"]
                
            await client_trade.cancel_order(
                orderId=str(order_id),
            )
    
        for tp_sl_info in tp_sl_orders_active:
            tasks.append(asyncio.create_task(process_order(tp_sl_info)))
        
        await asyncio.gather(*tasks) 

        await asyncio.gather(
            *[delete_tp_sl_order(account_id, trade_id, order['document_id'], order['trade_type']) for order in tp_sl_orders_active]
        )
        return
    except Exception as error:
        print(error)