import asyncio
from ..api.perpetual import BingXFunctions
from utils.firestore import store_sl, get_trade_info
from utils.message import message_replace_sl
from utils.notification import notification_replace_sl
from logs.logger import Logger
from ..scripts.order_factory import Order
from ..scripts.settings import get_position_quantity
from ..scripts.cancel import send_cancel

async def replace_sl(api_key, api_secret, data):
    try:
        # Creating session for bingx api
        session = BingXFunctions(api_key, api_secret)

        user_id = data['user_id']
        trader_id = data['trader_id']
        trade_id = data['trade_id']

        # Creating logger for info/errors
        logger = Logger(user_id, trade_id)

        document_id = data['document_id']
        payload = data['payload']

        logger.info(f"Starting replace sl with data: {data}")

        # Fetching the trade info from firestore
        trade_info = await get_trade_info(trader_id, user_id, trade_id)
        symbol = trade_info["symbol"]
        side = trade_info["side"]

        # Preparing position side stop-loss
        sl_position_side = "LONG" if side == "BUY" else "SHORT"

        # Fetch the current position and precisions
        # Cancel the current stop-loss
        position, precision, cancel = await asyncio.gather(
            session.get_position(symbol),
            session.get_precisions(symbol),
            send_cancel(session, symbol, user_id, trader_id, trade_id, document_id, "sl")
        )

        # Getting current position quantity to use for stop-loss order
        position_quantity = get_position_quantity(position, trade_info)
        logger.info(f"Position quantity for replace sl: {position_quantity}")

        price = round(float(payload["sl_value"]), precision["price_precision"])

        # Creating stop-loss order object
        order = Order(symbol, "TRIGGER_MARKET", "BUY" if side == "SELL" else "BUY", None, float(position_quantity),
                      sl_position_side, price, None)

        # Executing new stop-loss order
        create_order = await session.trade_order(order)

        # Preparing payload for storing in firestore
        payload['trade_id'] = trade_id
        payload["sl_amount"] = position_quantity
        payload["order_id"] = create_order["order"]["orderId"]
        payload['sl_document_id'] = document_id

        # Storing stop-loss in firestore
        await store_sl(trader_id, user_id, payload)

        logger.info(f"Executed replace_sl successfully")

        await notification_replace_sl(user_id, trade_id, payload['sl_document_id'], payload['sl_value'], payload['sl_percentage'])

        return message_replace_sl(trade_id, document_id, payload)

    except Exception as e:
        logger.error(e)
        raise e