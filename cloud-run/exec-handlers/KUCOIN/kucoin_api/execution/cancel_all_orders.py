from ..api.perpetual import KucoinFunctions
from utils.firestore import get_trade_info
from utils.message import message_cancel_orders
from utils.notification import notification_cancel_all_orders
from logs.error_logger import log_error
from ..scripts.order_factory import Order

async def cancel_all_orders(api_key, api_secret, api_passphrase, data):
    try:
        # Creating session for kucoin api
        session = KucoinFunctions(api_key, api_secret, api_passphrase)

        user_id = data['user_id']
        trade_id = data['trade_id']

        # Fetching the trade info from firestore
        trade_info = await get_trade_info(user_id, trade_id)
        symbol = trade_info["symbol"]

        # Getting current position info
        position = await session.get_position(symbol)

        # Getting current position quantity to use for cancel order
        quantity = position['currentQty'] if position['currentQty'] > 0 else position[
                                                                                 'currentQty'] * (-1)
        if float(quantity) != 0:
            side = trade_info['side']
            leverage = trade_info['leverage']

            # Creating order object for selling whole order
            order = Order(symbol, "market", "sell" if side == "buy" else "buy", None, quantity, leverage, None, None,
                          None, True)

            # Executing sell order to stop trade
            await session.trade_order(order)
        else:
            # Cancelling existing limit order
            await session.cancel_order(trade_info['orderID'])

        # Cancelling all active take-profits and stop-losses
        await session.cancel_all_orders(symbol)

        await notification_cancel_all_orders(user_id, trade_id)

        return message_cancel_orders(trade_id)

    except Exception as e:
        log_error(user_id, trade_id, e)
        raise e