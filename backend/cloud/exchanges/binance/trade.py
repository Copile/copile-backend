from binance.client import Client
from binance.exceptions import BinanceAPIException, BinanceOrderException
from binance.helpers import round_step_size

API_KEY = "i8x20EPFOccGzd2myU"
API_SECRET = "Z122p2lilBSaDPnAwKKvP0FNFnwhZFNidGf"


def binance_trade(uuid, side, symbol, leverage, Margin, price):
    client = Client(API_KEY, API_SECRET)
    side = 'BUY' if side == 'Buy' else 'SELL'
    info = client.futures_exchange_info()
    symbols = info['symbols']
    for i in range(len(symbols)):
        if symbols[i]['symbol'] == symbol:
            price_precision = symbols[i]['pricePrecision']
            precision = symbols[i]['quantityPrecision']
            for symbol_filter in symbols[i]['filters']:
                if symbol_filter['filterType'] == 'PRICE_FILTER':
                    price = round_step_size(price, float(symbol_filter['tickSize']))
            quantity_limit = round((float(Margin) * leverage) / float(price), price_precision)
            try:
                mode = client.futures_change_margin_type(
                    symbol=symbol,
                    marginType="CROSSED"
                )
            except BinanceAPIException as error:
                print(error)
            except BinanceOrderException as error:
                print(error)
            try:
                leverage_change = client.futures_change_leverage(
                    leverage=leverage,
                    symbol=symbol,
                )
                print(leverage_change)
            except BinanceAPIException as error:
                print(error)
            except BinanceOrderException as error:
                print(error)
            try:
                create_order = client.futures_create_order(
                    symbol=symbol,
                    side=side,
                    type='LIMIT',
                    timeinForce='GTC',
                    quantity=quantity_limit,
                    price=round(price, price_precision)
                )
                print(create_order)
                return f"**Successfully placed order! - {uuid} - {symbol}**"
            except BinanceAPIException as error:
                print(error)
            except BinanceOrderException as error:
                print(error)
