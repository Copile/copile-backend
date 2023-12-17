import asyncio
import logging
from ..api.perpetual import BinanceFunctions
from utils.firestore import store_sl, get_trade_info
from utils.message import message_send_sl
from utils.notification import send_notification
from ..scripts.order_factory import Order
from ..scripts.settings import get_position_quantity

logger = logging.getLogger(__name__)

async def send_sl(api_key, api_secret, data):
    try:
        # Creating session for binance api
        session = BinanceFunctions(api_key, api_secret)

        traderId = data['traderId']
        tradeId = data['tradeId']
        document_id = data['sl_id']
        payload = data['payload']

        # Fetching the trade info from firestore
        trade_info = await get_trade_info(traderId, tradeId)
        symbol = trade_info["symbol"]
        side = trade_info["side"]

        # Preparing position side stop-loss
        sl_side = "SELL" if side == "BUY" else "BUY"

        # Fetching current position and precision of symbol
        precision, position = await asyncio.gather(
            session.get_precisions(symbol),
            session.get_position(symbol)
        )

        # Getting current position quantity to use for stop-loss order
        position_quantity = get_position_quantity(position, trade_info)

        price = round(float(payload["sl_value"]), precision["price_precision"])

        # Creating stop-loss order object
        order = Order(symbol, "STOP_MARKET", sl_side, None, position_quantity, price, True)

        # Executing new stop-loss order
        create_order = await session.trade_order(order)

        # Preparing payload for storing in firestore
        payload['trade_id'] = tradeId
        payload["sl_amount"] = position_quantity
        payload["order_id"] = create_order["orderId"]
        payload['sl_document_id'] = document_id

        # Storing stop-loss in firestore
        await store_sl(traderId, payload)

        return message_send_sl(tradeId, payload)

    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)