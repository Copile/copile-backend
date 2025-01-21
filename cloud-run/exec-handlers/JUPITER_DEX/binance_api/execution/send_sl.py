import asyncio
from ..api.perpetual import BinanceFunctions
from utils.firestore import store_sl, get_trade_info
from utils.message import message_send_sl
from logs.logger import Logger
from ..scripts.order_factory import Order
from ..scripts.settings import get_position_quantity

async def send_sl(api_key, api_secret, data):
    try:
        # Creating session for binance api
        session = BinanceFunctions(api_key, api_secret)

        user_id = data['user_id']
        trade_id = data['trade_id']

        # Creating logger for info/errors
        logger = Logger(user_id, trade_id)

        document_id = data['sl_id']
        payload = data['payload']

        logger.info(f"Starting send sl with data: {data}")

        # Fetching the trade info from firestore
        trade_info = await get_trade_info(user_id, trade_id)
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
        logger.info(f"Position quantity for send sl: {position_quantity}")

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

        logger.info(f"Executed send_sl successfully")

        return message_send_sl(trade_id, payload)

    except Exception as e:
        logger.error(e)
        raise e