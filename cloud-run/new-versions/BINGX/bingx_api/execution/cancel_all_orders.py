import logging
from ..api.perpetual import BingXFunctions
from utils.firestore import get_trade_info
from utils.notification import notification_cancel_all_orders
from utils.message import message_cancel_orders
from ..scripts.order_factory import Order


logger = logging.getLogger(__name__)

async def cancel_all_orders(api_key, api_secret, data):
    try:
        # Creating session for bingx api
        session = BingXFunctions(api_key, api_secret)

        user_id = data['user_id']
        tradeId = data['tradeId']

        # Fetching the trade info from firestore
        trade_info = await get_trade_info(user_id, tradeId)
        symbol = trade_info["symbol"]

        # Getting current position info
        position = await session.get_position(symbol)

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

        await notification_cancel_all_orders(user_id, tradeId)

        return message_cancel_orders(tradeId)

    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)