from .bingX.perpetual.v2.Perpetual import Perpetual
from ..firestore_functions import get_tp_sl_info, delete_tp_sl_order, delete_order, check_executed_status, change_executed_status_tp_sl
import asyncio

async def send_cancel(account_id, trade_id, document_id, trade_type, trade_info, keys):
    client = Perpetual(api_key=keys["api_key"], api_secret=keys["api_secret"])
    symbol = trade_info["symbol"]
    order_id = trade_info["orderID"]

    if trade_type == "tp" or trade_type == "sl":
        status = await check_executed_status(account_id, trade_id, document_id, trade_type)
        if status == "1":
            tp_sl_info = await get_tp_sl_info(account_id, trade_id, document_id, trade_type)
            order_id = tp_sl_info["orderID"]
        else:
            await change_executed_status_tp_sl(account_id, trade_id, document_id, trade_type)
            return f"Cancelled potential {trade_type}-order for {account_id}"
    # Cancelling specific order
    try:
        cancel = client.cancel_order(
            orderId=int(order_id),
            symbol=symbol
        )
        if trade_type == "tp" or trade_type == "sl":
            await change_executed_status_tp_sl(account_id, trade_id, document_id, trade_type)
        else:
            await delete_order(account_id, trade_id)
            return f"Cancelled order ID: {str(order_id)} for {account_id}"
    except Exception as error:
        print(error)
