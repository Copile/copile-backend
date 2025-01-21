from utils.firestore import get_specific_order, delete_tp_sl_order
from logs.logger import Logger

async def send_cancel(session, symbol, trader_id, trade_id, document_id, trade_type):
    try:
        order = await get_specific_order(trader_id, trade_id, document_id, trade_type)

        await session.cancel_order(symbol, order['orderID'], None)
        await delete_tp_sl_order(trader_id, trade_id, document_id, trade_type)

        return
    except Exception as e:
        # Create logger for info/errors
        logger = Logger(trader_id, trade_id)
        logger.error(e)
        raise e