from pybit.inverse_futures import HTTP


def check_bybit(api_key, secret_key):
    try:
        session = HTTP(
            endpoint='https://api.bybit.com',
            api_key=api_key,
            api_secret=secret_key,
        )
        balance = session.get_wallet_balance(coin="USDT")['result']['USDT']['equity']
        return balance
    except Exception as error:
        return print("(check_bybit) Failed finding balance {}".format(error))
