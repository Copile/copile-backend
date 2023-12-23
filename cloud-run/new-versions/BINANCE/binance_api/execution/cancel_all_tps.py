import asyncio
import logging
from ..api.perpetual import BinanceFunctions
from utils.firestore import get_trade_info, get_tp_orders, delete_tp_sl_order
from utils.message import message_cancel_all_tps
from utils.notification import send_notification

logger = logging.getLogger(__name__)


async def cancel_all_tps(api_key, api_secret, data):
    try:
        # Creating session for binance api
        session = BinanceFunctions(api_key, api_secret)

        user_id = data['user_id']
        tradeId = data['tradeId']

        # Fetching the trade info and current take-profit orders from firestore
        trade_info, tp_orders = await asyncio.gather(
            get_trade_info(user_id, tradeId),
            get_tp_orders(user_id, tradeId)
        )

        # Cancelling all current take-profits order and deleting them from firestore
        await asyncio.gather(
            *[session.cancel_order(trade_info["symbol"], order['orderID'], None) for order in tp_orders])
        await asyncio.gather(
            *[delete_tp_sl_order(user_id, tradeId, order['document_id'], "tp") for order in tp_orders])

        return message_cancel_all_tps(tradeId, tp_orders)

    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)