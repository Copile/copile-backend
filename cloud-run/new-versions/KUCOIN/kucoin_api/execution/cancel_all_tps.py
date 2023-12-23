import asyncio
import logging
from ..api.perpetual import KucoinFunctions
from utils.firestore import get_tp_orders, delete_tp_sl_order
from utils.message import message_cancel_all_tps

logger = logging.getLogger(__name__)

async def cancel_all_tps(api_key, api_secret, api_passphrase, data):
    try:
        # Creating session for kucoin api
        session = KucoinFunctions(api_key, api_secret, api_passphrase)

        user_id = data['user_id']
        tradeId = data['tradeId']

        # Fetching the current take-profit orders from firestore
        tp_orders = await get_tp_orders(user_id, tradeId)

        # Cancelling all current take-profits order and deleting them from firestore
        await asyncio.gather(
            *[session.cancel_order(order['orderID']) for order in tp_orders])
        await asyncio.gather(
            *[delete_tp_sl_order(user_id, tradeId, order['document_id'], "tp") for order in tp_orders])
        return message_cancel_all_tps(tradeId, tp_orders)

    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)