from kucoin_futures.client import UserData


def check_kucoin(api_key, api_secret, api_passphrase):
    try:
        client = UserData(key=api_key, secret=api_secret, passphrase=api_passphrase, is_sandbox=False, url='')
        balance = client.get_account_overview(currency="USDT")['availableBalance']
        return balance
    except Exception as error:
        return print("(check_kucoin) Failed finding balance {}".format(error))
