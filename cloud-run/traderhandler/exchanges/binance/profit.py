from binance.client import Client
from ..firestore_functions import store_tp
from ..firestore_functions import get_user_keys
from ..firestore_functions import get_trade_info
import time


def send_profit(account_id, trade_id, tp_document_id, tp_number, tp_value, tp_percentage):
    keys = get_user_keys(account_id, "binance")
    client = Client(keys["api_key"], keys["api_secret"])

    trade_info = get_trade_info(account_id, trade_id)
    symbol = trade_info["symbol"]
    side = trade_info["side"]

    info = client.futures_exchange_info()
    symbols = info['symbols']
    for i in range(len(symbols)):
        if symbols[i]['symbol'] == symbol:
            price_precision = symbols[i]['pricePrecision']
            precision = symbols[i]['quantityPrecision']
    while True:
        time.sleep(2)
        position = client.futures_position_information(symbol=symbol)[0]['positionAmt']
        if int(position) != 0:
            TP_amount = round(float(position) * float(tp_percentage), precision)
            try:
                tp_order = client.futures_create_order(
                    symbol=symbol,
                    side='SELL' if side == 'BUY' else 'BUY',
                    type='TAKE_PROFIT_MARKET',
                    stopPrice=round(float(tp_value), price_precision),
                    quantity=TP_amount,
                    reduceOnly='True',
                )
                order_id = tp_order['orderId']
                tp_dict = {
                    "order_id": order_id,
                    "trade_id": trade_id,
                    "tp_document_id": tp_document_id,
                    "tp_number": tp_number,
                    "tp_value": tp_value,
                    "tp_percentage": tp_percentage
                }
                store_tp(account_id, tp_dict)
                return f"Successfully placed Take-Profit {tp_value} Order for {account_id}"
            except Exception as error:
                print(format(error))
