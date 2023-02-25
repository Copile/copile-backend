from kucoin_futures.client import Trade
from ..firestore_functions import get_user_keys, get_trade_info, get_tp_sl_info, delete_tp_sl_order, delete_order


def send_cancel(account_id, trade_id, document_id, trade_type):
    keys = get_user_keys(account_id, "bybit")
    client_trade = Trade(key=keys['api_key'], secret=keys['api_secret'], passphrase=keys['api_passphrase'],
                         is_sandbox=False, url='')

    trade_info = get_trade_info(account_id, trade_id)
    symbol = trade_info["symbol"]
    order_id = trade_info["orderID"]
    # Connecting to Kucoin API

    if trade_type == "tp" or trade_type == "sl":
        tp_sl_info = get_tp_sl_info(account_id, trade_id, document_id, trade_type)
        order_id = tp_sl_info["orderID"]
    # Cancelling specific order
    try:
        cancel = client_trade.cancel_order(
            orderId=order_id,
        )
        if trade_type == "tp" or trade_type == "sl":
            delete_tp_sl_order(account_id, trade_id, document_id, trade_type)
        else:
            delete_order(account_id, trade_id)
            return f"Cancelled order ID: {str(order_id)} for {account_id}"
    except Exception as error:
        print(error)
