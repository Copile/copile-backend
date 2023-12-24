from utils.firestore import get_specific_order, delete_tp_sl_order
from logs.error_logger import log_error

async def send_cancel(session, trader_id, trade_id, document_id, trade_type):
    try:
        order = await get_specific_order(trader_id, trade_id, document_id, trade_type)

        await session.cancel_order(order['orderID'])
        await delete_tp_sl_order(trader_id, trade_id, document_id, trade_type)

        return
    except Exception as e:
        log_error(trader_id, trade_id, e)
        raise e