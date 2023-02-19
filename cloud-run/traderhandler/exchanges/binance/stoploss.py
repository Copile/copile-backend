from binance.client import Client
from ..firestore_functions import store_sl
import time

API_KEY = "i8x20EPFOccGzd2myU"
API_SECRET = "Z122p2lilBSaDPnAwKKvP0FNFnwhZFNidGfS"


def send_stoploss(account_id, side, symbol, SL, SL_Percentage):
    client = Client(API_KEY, API_SECRET)
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
            SL_amount = round(float(position) * float(SL_Percentage), precision)
            try:
                SL_order = client.futures_create_order(
                    symbol=symbol,
                    side='SELL' if side == 'BUY' else 'BUY',
                    type='STOP_MARKET',
                    stopPrice=round(float(SL), price_precision),
                    quantity=SL_amount,
                    reduceOnly='True',
                )
                sl_dict = {
                    "trade_id": "this should be tradeID or orderID idek",
                    "sl": SL,
                    "sl_percentage": SL_Percentage
                }
                store_sl(account_id, sl_dict)
                return f"Successfully placed Stoploss {SL} Order for {account_id}"
            except Exception as error:
                print(format(error))
