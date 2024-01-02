from utils.firestore import get_specific_order, delete_tp_sl_order
from logs.error_logger import log_error

async def send_cancel(session, symbol, user_id, trade_id, document_id, trade_type):
    try:
        order = await get_specific_order(user_id, trade_id, document_id, trade_type)

        await session.cancel_order(symbol, order['orderID'], None)
        await delete_tp_sl_order(user_id, trade_id, document_id, trade_type)

        return
    except Exception as e:
        log_error(user_id, trade_id, e)
        raise e
