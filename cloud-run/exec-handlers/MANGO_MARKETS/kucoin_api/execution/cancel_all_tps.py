import asyncio
from ..api.perpetual import KucoinFunctions
from utils.firestore import get_tp_orders, delete_tp_sl_order
from utils.message import message_cancel_all_tps
from logs.logger import Logger

async def cancel_all_tps(api_key, api_secret, api_passphrase, data):
    try:
        # Creating session for kucoin api
        session = KucoinFunctions(api_key, api_secret, api_passphrase)

        user_id = data['user_id']
        trade_id = data['trade_id']

        # Creating logger for info/errors
        logger = Logger(user_id, trade_id)

        logger.info(f"Starting cancel all tps with data: {data}")

        # Fetching the current take-profit orders from firestore
        tp_orders = await get_tp_orders(user_id, trade_id)

        # Cancelling all current take-profits order and deleting them from firestore
        await asyncio.gather(
            *[session.cancel_order(order['orderID']) for order in tp_orders])
        await asyncio.gather(
            *[delete_tp_sl_order(user_id, trade_id, order['document_id'], "tp") for order in tp_orders])
        
        logger.info(f"Executed cancel_all_tps successfully")
        
        return message_cancel_all_tps(trade_id, tp_orders)

    except Exception as e:
        logger.error(e)
        raise e