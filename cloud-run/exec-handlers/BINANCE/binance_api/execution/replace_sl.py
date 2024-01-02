import asyncio
from ..api.perpetual import BinanceFunctions
from utils.firestore import store_sl, get_trade_info
from utils.message import message_replace_sl
from utils.notification import notification_replace_sl
from logs.error_logger import log_error
from ..scripts.order_factory import Order
from ..scripts.cancel import send_cancel
from ..scripts.settings import get_position_quantity

async def replace_sl(api_key, api_secret, data):
    try:
        # Creating session for binance api
        session = BinanceFunctions(api_key, api_secret)

        user_id = data['user_id']
        trade_id = data['trade_id']
        document_id = data['document_id']
        payload = data['payload']

        # Fetching the trade info from firestore
        trade_info = await get_trade_info(user_id, trade_id)
        symbol = trade_info["symbol"]
        side = trade_info["side"]

        # Preparing position side stop-loss
        sl_side = "BUY" if side == "SELL" else "SELL"

        # Fetch the current position and precisions
        # Cancel the current stop-loss
        precision, position, cancel = await asyncio.gather(
            session.get_precisions(symbol),
            session.get_position(symbol),
            send_cancel(session, symbol, user_id, trade_id, document_id, "sl")
        )

        # Getting current position quantity to use for stop-loss order
        position_quantity = get_position_quantity(position, trade_info)

        price = round(float(payload["sl_value"]), precision["price_precision"])

        # Creating stop-loss order object
        order = Order(symbol, "STOP_MARKET", sl_side, None, position_quantity, price, True)

        # Executing new stop-loss order
        create_order = await session.trade_order(order)

        # Preparing payload for storing in firestore
        payload['trade_id'] = trade_id
        payload["sl_amount"] = position_quantity
        payload["order_id"] = create_order["orderId"]
        payload['sl_document_id'] = document_id

        # Storing stop-loss in firestore
        await store_sl(user_id, payload)

        await notification_replace_sl(user_id, trade_id, payload['sl_document_id'], payload['sl_value'], payload['sl_percentage'])

        return message_replace_sl(trade_id, document_id, payload)

    except Exception as e:
        log_error(user_id, trade_id, e)
        raise e