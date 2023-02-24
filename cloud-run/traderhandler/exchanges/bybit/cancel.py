from pybit import usdt_perpetual
from ..firestore_functions import get_user_keys, get_trade_info, get_tp_sl_info, delete_tp_sl_order, delete_order


def send_cancel(account_id, trade_id, document_id, trade_type):
    keys = get_user_keys(account_id, "bybit")

    trade_info = get_trade_info(account_id, trade_id)
    symbol = trade_info["symbol"]
    order_id = trade_info["orderID"]

    if trade_type == "tp" or trade_type == "sl":
        tp_sl_info = get_tp_sl_info(account_id, trade_id, document_id, trade_type)
        order_id = tp_sl_info["orderID"]

    try:
        session = usdt_perpetual.HTTP(
            endpoint='https://api.bybit.com',
            api_key=keys["api_key"],
            api_secret=keys["api_secret"]
        )
        if trade_type == "tp" or trade_type == "sl":
            cancel = session.cancel_active_order(
                symbol=symbol,
                order_id=order_id
            )
            print(cancel)
            delete_tp_sl_order(account_id, trade_id, document_id, trade_type)
            return f"Cancelled order ID: {str(order_id)} for {account_id}"
        else:
            cancel = session.cancel_conditional_order(
                symbol=symbol,
                stop_order_id=order_id
            )
            print(cancel)
            delete_order(account_id, trade_id)
            return f"Cancelled order ID: {str(order_id)} for {account_id}"
    except Exception as error:
        print(f"{error} - {account_id}")
