from binance.client import Client
from ..firestore_functions import store_trade_data
import time

API_KEY = "i8x20EPFOccGzd2myU"
API_SECRET = "Z122p2lilBSaDPnAwKKvP0FNFnwhZFNidGfS"


def send_stoploss(uuid, side, symbol, SL, SL_Percentage):
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
                print(SL_order)
                return f"Successfully placed Stoploss {SL} Order for {uuid}"
            except Exception as error:
                print(format(error))
