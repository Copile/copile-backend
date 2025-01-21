from ..api.perpetual import BingXFunctions
from utils.firestore import get_trade_info
from utils.notification import notification_cancel_all_orders
from utils.message import message_cancel_orders
from logs.logger import Logger
from ..scripts.order_factory import Order

async def cancel_all_orders(api_key, api_secret, data):
    try:
        # Creating session for bingx api
        session = BingXFunctions(api_key, api_secret)

        user_id = data['user_id']
        trader_id = data['trader_id']
        trade_id = data['trade_id']

        # Creating logger for info/errors
        logger = Logger(user_id, trade_id)

        logger.info(f"Starting cancel all orders with data: {data}")

        # Fetching the trade info from firestore
        trade_info = await get_trade_info(trader_id, user_id, trade_id)
        symbol = trade_info["symbol"]

        # Getting current position info
        position = await session.get_position(symbol)
        logger.info(f"Position info: {position}")

        if len(position) != 0:
            quantity = position[0]["positionAmt"]
            position_side = position[0]["positionSide"]

            emergency_side = "SELL" if position_side == "LONG" else "BUY"

            # Creating order object for selling whole position
            emergency_order = Order(symbol, "MARKET", emergency_side, None, quantity, position_side, None, None)

            # Executing sell order to stop trade
            await session.trade_order(emergency_order)
        else:
            # Cancelling existing limit order
            await session.cancel_all_orders(symbol)

        # Cancelling all active take-profits and stop-losses
        await session.cancel_all_orders(symbol)

        logger.info(f"Executed cancel_all_orders successfully")

        await notification_cancel_all_orders(user_id, trade_id)

        return message_cancel_orders(trade_id)

    except Exception as e:
        logger.error(e)
        raise e