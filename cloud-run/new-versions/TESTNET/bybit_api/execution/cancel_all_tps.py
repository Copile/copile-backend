import asyncio
import logging
from ..api.perpetual import BybitFunctions
from utils.firestore import get_trade_info, get_tp_orders, delete_tp_sl_order
from utils.message import message_cancel_all_tps

logger = logging.getLogger(__name__)


async def cancel_all_tps(api_key, api_secret, data):
    try:
        # Creating session for bybit api
        session = BybitFunctions(api_key, api_secret)

        traderId = data['traderId']
        tradeId = data['tradeId']

        # Fetching the trade info and current take-profit orders from firestore
        trade_info, tp_orders = await asyncio.gather(
            get_trade_info(traderId, tradeId),
            get_tp_orders(traderId, tradeId)
        )

        # Cancelling all current take-profits order and deleting them from firestore
        await asyncio.gather(
            *[session.cancel_order(trade_info["symbol"], order['orderID'], None) for order in tp_orders])
        await asyncio.gather(
            *[delete_tp_sl_order(traderId, tradeId, order['document_id'], "tp") for order in tp_orders])
        return message_cancel_all_tps(tradeId, tp_orders)

    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)