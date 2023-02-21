from binance.client import Client
from ..firestore_functions import store_sl
from ..firestore_functions import get_user_keys
from ..firestore_functions import get_trade_info
import time


def send_stoploss(account_id, trade_id, sl_document_id, sl_number, sl_value, sl_percentage):
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
            sl_amount = round(float(position) * float(sl_percentage), precision)
            try:
                sl_order = client.futures_create_order(
                    symbol=symbol,
                    side='SELL' if side == 'BUY' else 'BUY',
                    type='STOP_MARKET',
                    stopPrice=round(float(sl_value), price_precision),
                    quantity=sl_amount,
                    reduceOnly='True',
                )
                sl_dict = {
                    "order_id": sl_order.get("orderId"),
                    "trade_id": trade_id,
                    "sl_document_id": sl_document_id,
                    "sl_number": sl_number,
                    "sl_value": sl_value,
                    "sl_percentage": sl_percentage
                }
                store_sl(account_id, sl_dict)
                return f"Successfully placed Stoploss {sl_value} Order for {account_id}"
            except Exception as error:
                print(format(error))
