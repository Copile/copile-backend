import logging
from ..api.perpetual import BybitFunctions
from utils.firestore import get_trade_info
from utils.message import message_cancel_orders
from utils.notification import notification_cancel_all_orders
from ..scripts.order_factory import Order

logger = logging.getLogger(__name__)

async def cancel_all_orders(api_key, api_secret, data):
    try:
        # Creating session for bybit api
        session = BybitFunctions(api_key, api_secret)

        user_id = data['user_id']
        tradeId = data['tradeId']

        # Fetching the trade info from firestore
        trade_info = await get_trade_info(user_id, tradeId)
        symbol = trade_info["symbol"]

        # Getting current position info
        position = await session.get_position(symbol)

        # Getting current position quantity to use for cancel order
        quantity = float(position['size'])

        if quantity != 0:
            side = trade_info['side']

            # Creating order object for selling whole order
            order = Order(symbol, "Market", 'Buy' if side == 'Sell' else 'Sell', None, quantity, None, None, None, True,
                          False)

            # Executing sell order to stop trade
            await session.trade_order(order)
        else:
            # Cancelling existing limit order
            await session.cancel_order(symbol, trade_info['orderID'], None)

        # Cancelling all active take-profits and stop-losses
        await session.cancel_all_orders(symbol)

        await notification_cancel_all_orders(user_id, tradeId)

        return message_cancel_orders(tradeId)

    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)