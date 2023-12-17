import logging
from ..api.perpetual import BinanceFunctions
from utils.firestore import get_trade_info
from utils.message import message_cancel_order
from ..scripts.cancel import send_cancel

logger = logging.getLogger(__name__)

async def cancel_order(api_key, api_secret, data):
    try:
        # Creating session for binance api
        session = BinanceFunctions(api_key, api_secret)

        traderId = data['traderId']
        tradeId = data['tradeId']
        document_id = data['document_id']
        trade_type = data['trade_type']

        # Fetching the trade info from firestore
        trade_info = await get_trade_info(traderId, tradeId)
        symbol = trade_info["symbol"]

        # Cancelling specific order based on trade_type (tp/sl)
        await send_cancel(session, symbol, traderId, tradeId, document_id, trade_type)

        return message_cancel_order(tradeId, document_id, trade_type)

    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)