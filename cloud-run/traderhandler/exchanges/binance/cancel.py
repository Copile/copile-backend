from binance.client import Client
from binance.exceptions import BinanceAPIException, BinanceOrderException
from binance.helpers import round_step_size

API_KEY = "i8x20EPFOccGzd2myU"
API_SECRET = "Z122p2lilBSaDPnAwKKvP0FNFnwhZFNidGf"


def send_cancel(uuid, symbol, order_id):

    try:
        client = Client(API_KEY, API_SECRET)

        cancel = client.futures_cancel_order(
            symbol=symbol,
            orderID=int(float(order_id))
        )
        print(cancel)
        return f"Cancelled order ID: {str(order_id)} for {uuid}"
    except BinanceAPIException as error:
        print(error)
    except BinanceOrderException as error:
        print(error)
