import asyncio
import logging
from ..api.perpetual import BybitFunctions
from utils.firestore import store_sl, get_trade_info
from utils.message import message_replace_sl
from utils.notification import send_notification
from ..scripts.order_factory import Order
from ..scripts.cancel import send_cancel
from ..scripts.settings import get_position_quantity

logger = logging.getLogger(__name__)

async def replace_sl(api_key, api_secret, data):
    try:
        # Creating session for bybit api
        session = BybitFunctions(api_key, api_secret)

        traderId = data['traderId']
        tradeId = data['tradeId']
        document_id = data['document_id']
        payload = data['payload']

        # Fetching the trade info from firestore
        trade_info = await get_trade_info(traderId, tradeId)
        symbol = trade_info["symbol"]
        side = trade_info["side"]

        # Preparing position side stop-loss
        sl_side = "Buy" if side == "Sell" else "Sell"
        trigger_direction = 1 if side == "Sell" else 2

        # Fetching current position and precision of symbol
        # Changing the tp/sl mode to partial for sending stop-losses
        # Cancelling old stop-loss
        precision, position, tp_sl_mode, cancel = await asyncio.gather(
            session.get_precisions(symbol),
            session.get_position(symbol),
            session.set_tp_sl_mode(symbol, "Partial"),
            send_cancel(session, symbol, traderId, tradeId, document_id, "sl")
        )

        # Getting current position quantity to use for stop-loss order
        position_quantity = get_position_quantity(position, trade_info)

        price = round(float(payload["sl_value"]), precision["price_precision"])

        # Creating stop-loss order object
        order = Order(symbol, "Limit", sl_side, price, position_quantity, trigger_direction, price,
                      "MarkPrice", True, True)

        # Executing new stop-loss order
        create_order = await session.trade_order(order)

        # Preparing payload for storing in firestore
        payload['trade_id'] = tradeId
        payload["sl_amount"] = position_quantity
        payload["order_id"] = create_order["orderId"]
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