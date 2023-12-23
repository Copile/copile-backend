from utils.firestore import get_specific_order, delete_tp_sl_order
import logging

logger = logging.getLogger(__name__)


async def send_cancel(session, user_id, trade_id, document_id, trade_type):
    try:
        order = await get_specific_order(user_id, trade_id, document_id, trade_type)

        await session.cancel_order(order['orderID'])
        await delete_tp_sl_order(user_id, trade_id, document_id, trade_type)

        return
    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)
