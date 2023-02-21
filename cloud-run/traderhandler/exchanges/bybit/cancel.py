from pybit import usdt_perpetual


def send_cancel(account_id, symbol, order_id, type):
    API_KEY = "i8x20EPFOccGzd2myU"
    API_SECRET = "Z122p2lilBSaDPnAwKKvP0FNFnwhZFNidGfS"

    try:
        session = usdt_perpetual.HTTP(
            endpoint='https://api.bybit.com',
            api_key=API_KEY,
            api_secret=API_SECRET
        )
        if type != "conditional":
            cancel = session.cancel_active_order(
                symbol=symbol,
                order_id=order_id
            )
            print(cancel)
            return f"Cancelled order ID: {str(order_id)} for {account_id}"
        else:
            cancel = session.cancel_conditional_order(
                symbol=symbol,
                stop_order_id=order_id
            )
            print(cancel)
            return f"Cancelled order ID: {str(order_id)} for {account_id}"
    except Exception as error:
        print(f"{error} - {account_id}")
