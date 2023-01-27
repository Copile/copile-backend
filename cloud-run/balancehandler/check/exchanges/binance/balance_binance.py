from binance.client import Client


def check_binance(api_key, secret_key):
    try:
        client = Client(api_key, secret_key)
        balance_search = client.futures_account_balance()
        balance = round(float(balance_search[6]['balance']), 2)
        return balance
    except Exception as error:
        return print("(check_binance) Failed finding balance {}".format(error))
