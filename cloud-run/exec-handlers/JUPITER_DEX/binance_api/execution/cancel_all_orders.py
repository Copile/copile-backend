from ..api.perpetual import BinanceFunctions
from utils.firestore import get_trade_info
from utils.message import message_cancel_orders
from utils.notification import notification_cancel_all_orders
from logs.logger import Logger
from ..scripts.order_factory import Order

async def cancel_all_orders(api_key, api_secret, data):
    try:
        # Creating session for binance api
        session = BinanceFunctions(api_key, api_secret)

        user_id = data['user_id']
        trade_id = data['trade_id']

        # Creating logger for info/errors
        logger = Logger(user_id, trade_id)

        logger.info(f"Starting cancel all orders with data: {data}")

        # Fetching the trade info from firestore
        trade_info = await get_trade_info(user_id, trade_id)
        symbol = trade_info["symbol"]

        # Getting current position info
        position = await session.get_position(symbol)

        logger.info(f"Position info: {position}")

        quantity = float(position['positionAmt'])

        if quantity != 0:
            side = trade_info['side']

            # Creating order object for selling whole position
            order = Order(symbol, "MARKET", "SELL" if side == "BUY" else "BUY", None, None, None, True)

            # Executing sell order to stop trade
            await session.trade_order(order)
        else:
            # Cancelling existing limit order
            await session.cancel_order(symbol, trade_info['orderID'], None)

        # Cancelling all active take-profits and stop-losses
        await session.cancel_all_orders(symbol)

        logger.info(f"Executed cancel_all_orders successfully")

        await notification_cancel_all_orders(user_id, trade_id)

        return message_cancel_orders(trade_id)

    except Exception as e:
        logger.error(e)
        raise e