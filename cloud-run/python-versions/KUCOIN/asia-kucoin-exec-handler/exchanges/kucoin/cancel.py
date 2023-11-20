from .kuclib.client import Trade
from ..firestore_functions import get_tp_sl_info, delete_tp_sl_order, delete_order, check_executed_status, change_executed_status_tp_sl

async def send_cancel(account_id, trade_id, document_id, trade_type, trade_info, keys):
    try:
        client_trade = Trade(key=keys['api_key'], secret=keys['api_secret'], passphrase=keys['api_passphrase'],
                            is_sandbox=False, url='')
        
        order_id = trade_info["orderID"]

        if trade_type == "tp" or trade_type == "sl":
            status = await check_executed_status(account_id, trade_id, document_id, trade_type)
            if status == "1":
                tp_sl_info = await get_tp_sl_info(account_id, trade_id, document_id, trade_type)
                order_id = tp_sl_info["orderID"]
            else:
                await change_executed_status_tp_sl(account_id, trade_id, document_id, trade_type)
                return f"Cancelled potential {trade_type}-order for {account_id}"

        await client_trade.cancel_order(
            orderId=order_id,
        )
        if trade_type == "tp" or trade_type == "sl":
            await delete_tp_sl_order(account_id, trade_id, document_id, trade_type)
        else:
            await delete_order(account_id, trade_id)
            return f"Cancelled order ID: {str(order_id)} for {account_id}"
    except Exception as error:
        print(error)