from binance.client import Client
import time

API_KEY = "i8x20EPFOccGzd2myU"
API_SECRET = "Z122p2lilBSaDPnAwKKvP0FNFnwhZFNidGf"


def binance_profit(uuid, side, symbol, TP, TP_Percentage):
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
            TP_amount = round(float(position) * float(TP_Percentage), precision)
            try:
                TP = client.futures_create_order(
                    symbol=symbol,
                    side='SELL' if side == 'BUY' else 'BUY',
                    type='TAKE_PROFIT_MARKET',
                    stopPrice=round(float(TP), price_precision),
                    quantity=TP_amount,
                    reduceOnly='True',
                )
                return f"Successfully placed Take-Profit {TP} Order for {uuid}"
            except Exception as error:
                print(format(error))

