from pybit.unified_trading import HTTP
from ..firestore_functions import get_tp_sl_info, delete_tp_sl_order, delete_order, check_executed_status, change_executed_status_tp_sl
import asyncio

async def send_cancel(account_id, trade_id, document_id, trade_type, trade_info, keys):
    symbol = trade_info["symbol"]
    order_id = trade_info["orderID"]

    if trade_type == "tp" or trade_type == "sl":
        document_status = await check_executed_status(account_id, trade_id, document_id, trade_type)
        if document_status == "1":
            tp_sl_info = await get_tp_sl_info(account_id, trade_id, document_id, trade_type)
            order_id = tp_sl_info["orderID"]
        else:
            await change_executed_status_tp_sl(account_id, trade_id, document_id, trade_type)
            return f"Cancelled potential {trade_type}-order for {account_id}"
    try:
        # Connecting to Bybit API
        session = HTTP(
            testnet=False,
            api_key=keys["api_key"],
            api_secret=keys["api_secret"],
        )
        if trade_type == "tp" or trade_type == "sl":
            cancel = session.cancel_order(
                category="linear",
                symbol=symbol,
                orderId=order_id
            )
            await change_executed_status_tp_sl(account_id, trade_id, document_id, trade_type)
            return f"Cancelled order ID: {str(order_id)} for {account_id}"
        else:
            cancel = session.cancel_order(
                category="linear",
                symbol=symbol,
                orderId=order_id
            )
            return f"Cancelled order ID: {str(order_id)} for {account_id}"
    except Exception as error:
        print(f"{error} - {account_id}")