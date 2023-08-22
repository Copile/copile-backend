from .bingX.perpetual.v2.Perpetual import Perpetual
from ..firestore_functions import get_tp_sl_orders, change_executed_status_tp_sl, delete_tp_sl_order, change_executed_status_tp_sl
import asyncio

async def clear_orders(account_id, trade_id, trade_info, keys):
    tp_sl_orders = await get_tp_sl_orders(account_id, trade_id)
    symbol = trade_info["symbol"]
    
    if not tp_sl_orders:
        return f"No TP/SL orders to clear for {account_id} - {trade_id}"

    client = Perpetual(api_key=keys["api_key"], api_secret=keys["api_secret"])
    tasks = []

    async def process_order(tp_sl_info):
        nonlocal tasks
        
        order_id = tp_sl_info["orderID"]
        executed = tp_sl_info["executed"]

        if executed == "0":
            await change_executed_status_tp_sl(account_id, trade_id, tp_sl_info["document_id"], tp_sl_info["trade_type"])
        else:
            try:
                client.cancel_order(orderId=int(order_id), symbol=symbol)
                await change_executed_status_tp_sl(account_id, trade_id, tp_sl_info["document_id"], tp_sl_info["trade_type"])
                print(f"Cancelled order ID: {trade_id} for {account_id}")
            except Exception as error:
                print(f"{error} - {account_id}")

    for tp_sl_info in tp_sl_orders:
        tasks.append(asyncio.create_task(process_order(tp_sl_info)))

    await asyncio.gather(*tasks)
    return f"Cleared all TPs and SLs for {account_id} - {trade_id}"
