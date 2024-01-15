import asyncio
from ..api.perpetual import KucoinFunctions
from utils.firestore import store_sl, get_trade_info
from utils.message import message_send_sl
from logs.logger import Logger
from ..scripts.order_factory import Order
from ..scripts.settings import get_position_quantity

async def send_sl(api_key, api_secret, api_passphrase, data):
    try:
        # Creating session for kucoin api
        session = KucoinFunctions(api_key, api_secret, api_passphrase)

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
        leverage = trade_info["leverage"]

        # Preparing position side stop-loss        
        sl_side = "sell" if side == "buy" else "buy"
        stop = "up" if side == "sell" else "down"

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
        order = Order(symbol, "market", sl_side, price, position_quantity, leverage, stop, "MP", price,
                      True)

        # Executing new stop-loss order
        create_order = await session.trade_order(order)

        # Preparing payload for storing in firestore
        payload['trade_id'] = trade_id
        payload["sl_amount"] = position_quantity
        payload["order_id"] = create_order["orderId"]
        payload['sl_document_id'] = document_id

        logger.info(f"Storing stop-loss in firestore: {payload}")

        # Storing stop-loss in firestore
        await store_sl(user_id, payload)

        return message_send_sl(trade_id, payload)

    except Exception as e:
        logger.error(e)
        raise e