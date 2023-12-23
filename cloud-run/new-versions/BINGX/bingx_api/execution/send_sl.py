import logging
import asyncio
from ..api.perpetual import BingXFunctions
from utils.firestore import store_sl, get_trade_info
from utils.message import message_send_sl
from ..scripts.order_factory import Order
from ..scripts.settings import get_position_quantity

logger = logging.getLogger(__name__)

async def send_sl(api_key, api_secret, data):
    try:
        # Creating session for bingx api
        session = BingXFunctions(api_key, api_secret)

        user_id = data['user_id']
        trade_id = data['trade_id']
        document_id = data['sl_id']
        payload = data['payload']

        # Fetching the trade info from firestore
        trade_info = await get_trade_info(user_id, trade_id)
        symbol = trade_info["symbol"]
        side = trade_info["side"]

        # Preparing position side stop-loss
        sl_position_side = "LONG" if side == "BUY" else "SHORT"

        # Fetching current position and precision of symbol
        position, precision = await asyncio.gather(
            session.get_position(symbol),
            session.get_precisions(symbol)
        )

        # Getting current position quantity to use for stop-loss order
        position_quantity = get_position_quantity(position, trade_info)

        price = round(float(payload["sl_value"]), precision["price_precision"])

        # Creating stop-loss order object
        order = Order(symbol, "TRIGGER_MARKET", "BUY" if side == "SELL" else "BUY", None, position_quantity,
                      sl_position_side, price, None)

        # Executing new stop-loss order
        create_order = await session.trade_order(order)

        # Preparing payload for storing in firestore
        payload['trade_id'] = trade_id
        payload["sl_amount"] = position_quantity
        payload["order_id"] = create_order["order"]["orderId"]
        payload['sl_document_id'] = document_id

        # Storing stop-loss in firestore
        await store_sl(user_id, payload)

        return message_send_sl(trade_id, payload)

    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)