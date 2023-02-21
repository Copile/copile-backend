from pybit import usdt_perpetual
from ..firestore_functions import get_user_keys, get_trade_info


def send_emergency(account_id, trade_id):
    keys = get_user_keys(account_id, "bybit")

    trade_info = get_trade_info(account_id, trade_id)
    symbol = trade_info["symbol"]
    side = trade_info["side"]

    side = 'BUY' if side == 'Buy' else 'SELL'

    session = usdt_perpetual.HTTP(
        endpoint='https://api.bybit.com',
        api_key=keys["api_key"],
        api_secret=keys["api_secret"]
    )
    position = str(session.my_position(symbol=symbol)['result'][0 if side == 'BUY' else 1]['size'])
    if position != '0':
        try:
            stop = session.place_active_order(
                side='Buy' if side == 'Sell' else 'Sell',
                symbol=symbol,
                order_type="Market",
                qty=float(position),
                time_in_force="GoodTillCancel",
                reduce_only=True,
                close_on_trigger=False,
            )
            print(stop)
            return
        except Exception as error:
            print(error)
    elif position == '0':
        order_id = str(session.my_position(symbol=symbol)['result'][0 if side == 'BUY' else 1]['data'][0]['order_id'])
        try:
            stop = session.cancel_active_order(
                symbol=symbol,
                order_id=order_id
            )
            print(stop)
            return
        except Exception as error:
            print(error)
