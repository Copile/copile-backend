from .binlib.um_futures import UMFutures
from ..firestore_functions import get_tp_sl_info, delete_tp_sl_order, delete_order, check_executed_status, change_executed_status_tp_sl

async def send_cancel(account_id, trade_id, document_id, trade_type, trade_info, keys):
    try:
        symbol = trade_info['symbol']
        order_id = trade_info['orderID']
        
        client = UMFutures(key=keys['api_key'], secret=keys['api_secret'])

        if trade_type == "tp" or trade_type == "sl":
            status = await check_executed_status(account_id, trade_id, document_id, trade_type)
            if status == "1":
                tp_sl_info = await get_tp_sl_info(account_id, trade_id, document_id, trade_type)
                order_id = tp_sl_info["orderID"]
            else:
                await change_executed_status_tp_sl(account_id, trade_id, document_id, trade_type, "2")
                return f"Cancelled potential {trade_type}-order for {account_id}"
        # Cancelling specific order
        cancel = await client.cancel_order(
            symbol=symbol,
            orderId=int(order_id)
        )
        if trade_type == "tp" or trade_type == "sl":
            await delete_tp_sl_order(account_id, trade_id, document_id, trade_type)
        else:
            await delete_order(account_id, trade_id)
            return f"Cancelled order ID: {str(order_id)} for {account_id}"
    except Exception as error:
        print(error)
    