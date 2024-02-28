from ..api.perpetual import KucoinFunctions
from utils.message import message_cancel_order
from utils.notification import notification_cancel_order
from logs.logger import Logger
from ..scripts.cancel import send_cancel

async def cancel_order(api_key, api_secret, api_passphrase, data):
    try:
        # Creating session for kucoin api
        session = KucoinFunctions(api_key, api_secret, api_passphrase)

        user_id = data['user_id']
        trade_id = data['trade_id']

        # Creating logger for info/errors
        logger = Logger(user_id, trade_id)

        logger.info(f"Starting cancel order with data: {data}")

        document_id = data['document_id']
        trade_type = data['trade_type']

        # Cancelling specific order based on trade_type (tp/sl)
        await send_cancel(session, user_id, trade_id, document_id, trade_type)

        logger.info(f"Executed cancel_order successfully")

        await notification_cancel_order(user_id, trade_id, document_id)

        return message_cancel_order(trade_id, document_id, trade_type)

    except Exception as e:
        logger.error(e)
        raise e
