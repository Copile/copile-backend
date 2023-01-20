from binance.client import Client
from binance.exceptions import BinanceAPIException, BinanceOrderException
from binance.helpers import round_step_size

API_KEY = "i8x20EPFOccGzd2myU"
API_SECRET = "Z122p2lilBSaDPnAwKKvP0FNFnwhZFNidGf"


def binance_emergency(uuid, side, symbol):
    client = Client(API_KEY, API_SECRET)
    side = 'BUY' if side == 'Buy' else 'SELL'
    position = client.futures_position_information(
        symbol=symbol
    )
    price = position[0]['markPrice']
    if int(position[0]['positionAmt']) > 0:
        try:
            stop = client.futures_create_order(
                symbol=symbol,
                side='BUY' if side == 'SELL' else 'SELL',
                type='STOP_MARKET',
                stopPrice=int(price),
                quantity=int(position[0]['positionAmt']),
                reduceOnly='True',
                closingPosition='True',
                priceProtect='True',
            )
            return
        except BinanceAPIException as error:
            print(error)
        except BinanceOrderException as error:
            print(error)
    elif int(position[0]['positionAmt']) <= 0:
        order = client.futures_get_open_orders(symbol=symbol)[0]['orderId']
        try:
            stop = client.futures_cancel_order(
                symbol=symbol,
                orderId=int(float(order))
            )
            return
        except BinanceAPIException as error:
            print(error)
        except BinanceOrderException as error:
            print(error)
