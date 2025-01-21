import logging
from ..api.perpetual import BingXFunctions
from utils.firestore import get_trade_info
from utils.message import message_cancel_order
from utils.notification import notification_cancel_order
from logs.logger import Logger
from ..scripts.cancel import send_cancel

async def cancel_order(api_key, api_secret, data):
    try:
        # Creating session for bybit api
        session = BingXFunctions(api_key, api_secret)

        user_id = data['user_id']
        trade_id = data['trade_id']

        # Creating logger for info/errors
        logger = Logger(user_id, trade_id)

        logger.info(f"Starting cancel order with data: {data}")

        document_id = data['document_id']
        trade_type = data['trade_type']

        # Fetching the trade info from firestore
        trade_info = await get_trade_info(user_id, trade_id)
        symbol = trade_info["symbol"]

        # Cancelling specific order based on trade_type (tp/sl)
        await send_cancel(session, symbol, user_id, trade_id, document_id, trade_type)

        logger.info(f"Executed cancel_order successfully")

        await notification_cancel_order(user_id, trade_id, document_id)
        
        return message_cancel_order(trade_id, document_id, trade_type)

    except Exception as e:
        logger.error(e)
        raise e