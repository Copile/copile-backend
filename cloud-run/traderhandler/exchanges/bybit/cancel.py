from pybit import usdt_perpetual


def send_cancel(uuid, symbol, order_id):
    API_KEY = "i8x20EPFOccGzd2myU"
    API_SECRET = "Z122p2lilBSaDPnAwKKvP0FNFnwhZFNidGfS"

    try:
        session = usdt_perpetual.HTTP(
            endpoint='https://api.bybit.com',
            api_key=API_KEY,
            api_secret=API_SECRET
        )
        cancel = session.cancel_active_order(
            symbol=symbol,
            order_id=order_id
        )
        print(cancel)
        return f"Cancelled order ID: {str(order_id)} for {uuid}"
    except Exception as error:
        print(f"{error} - {uuid}")
