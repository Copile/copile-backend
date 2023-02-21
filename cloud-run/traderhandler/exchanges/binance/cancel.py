from binance.client import Client
from binance.exceptions import BinanceAPIException, BinanceOrderException
from ..firestore_functions import get_user_keys
from ..firestore_functions import get_trade_info
from ..firestore_functions import get_tp_sl_info
from ..firestore_functions import delete_order
from ..firestore_functions import delete_tp_sl_order


def send_cancel(account_id, trade_id, document_id, trade_type):
    try:
        keys = get_user_keys(account_id, "binance")
        client = Client(keys["api_key"], keys["api_secret"])

        trade_info = get_trade_info(account_id, trade_id)
        symbol = trade_info["symbol"]
        order_id = trade_info["order_id"]

        if trade_type == "tp" or trade_type == "sl":
            tp_sl_info = get_tp_sl_info(account_id, trade_id, document_id, trade_type)
            order_id = tp_sl_info["order_id"]

        cancel = client.futures_cancel_order(
            symbol=symbol,
            orderID=int(float(order_id))
        )
        print(cancel)
        if trade_type == "tp" or trade_type == "sl":
            delete_tp_sl_order(account_id, trade_id, document_id, trade_type)
        else:
            delete_order(account_id, trade_id)
        return f"Cancelled {trade_type} order ID: {str(order_id)} for {account_id}"
    except BinanceAPIException as error:
        print(error)
    except BinanceOrderException as error:
        print(error)
