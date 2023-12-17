import asyncio
import logging
from ..api.perpetual import BingXFunctions
from utils.firestore import store_sl, get_trade_info
from utils.message import message_replace_sl
from utils.notification import send_notification
from ..scripts.order_factory import Order
from ..scripts.settings import get_position_quantity
from ..scripts.cancel import send_cancel

logger = logging.getLogger(__name__)

async def replace_sl(api_key, api_secret, data):
    try:
        # Creating session for bingx api
        session = BingXFunctions(api_key, api_secret)

        traderId = data['traderId']
        tradeId = data['tradeId']
        document_id = data['document_id']
        payload = data['payload']

        # Fetching the trade info from firestore
        trade_info = await get_trade_info(traderId, tradeId)
        symbol = trade_info["symbol"]
        side = trade_info["side"]

        # Preparing position side stop-loss
        sl_position_side = "LONG" if side == "BUY" else "SHORT"

        # Fetch the current position and precisions
        # Cancel the current stop-loss
        position, precision, cancel = await asyncio.gather(
            session.get_position(symbol),
            session.get_precisions(symbol),
            send_cancel(session, symbol, traderId, tradeId, document_id, "sl")
        )

        # Getting current position quantity to use for stop-loss order
        position_quantity = get_position_quantity(position, trade_info)

        price = round(float(payload["sl_value"]), precision["price_precision"])

        # Creating stop-loss order object
        order = Order(symbol, "TRIGGER_MARKET", "BUY" if side == "SELL" else "BUY", None, float(position_quantity),
                      sl_position_side, price, None)

        # Executing new stop-loss order
        create_order = await session.trade_order(order)

        # Preparing payload for storing in firestore
        payload['trade_id'] = tradeId
        payload["sl_amount"] = position_quantity
        payload["order_id"] = create_order["order"]["orderId"]
        payload['sl_document_id'] = document_id

        # Storing stop-loss in firestore
        await store_sl(traderId, payload)

        notification = {
            "data": {
                "document_id": payload['sl_id'],
                "sl_value": payload['sl_value'],
                "sl_percentage": payload['sl_percentage']
            },
            "trade_id": tradeId,
            "user_id": traderId
        }

        await send_notification(notification, "replace_sl")

        return message_replace_sl(tradeId, document_id, payload)

    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)