from google.cloud import firestore
from .exchanges.kucoin.balance_kucoin import check_kucoin
from .exchanges.bybit.balance_bybit import check_bybit
from .exchanges.binance.balance_binance import check_binance
import time
import json

db = firestore.Client(project='copile')


def check_balance(license):
    try:
        user = db.collection(u'users').document(f'{license}').get()
        exchanges = user.get("exchanges")

        data = {
            'date': str(int(time.time())),
            'exchanges': {
                'bybit': '',
                'kucoin': '',
                'binance': ''
            }
        }

        for item in exchanges:
            if exchanges[item]['api_key'] != "x":
                if item != "kucoin":
                    exchange = exchanges[item]
                    api_key = exchange['api_key']
                    api_secret = exchange['api_secret']
                    get_balance = eval("check_" + f"{item}(api_key, api_secret)")
                    data['exchanges'][f'{item}'] = str(get_balance)
                else:
                    exchange = exchanges[item]
                    api_key = exchange['api_key']
                    api_secret = exchange['api_secret']
                    api_passphrase = exchange['api_passphrase']
                    get_balance = eval("check_" + f"{item}(api_key, api_secret, api_passphrase)")
                    data['exchanges'][f'{item}'] = str(get_balance)

        new = db.collection(u'users').document(f'{license}').collection(u'balances').document(str(int(time.time()))).set(data)
        return {f"Created Balance Document for {license} for {str(int(time.time()))} "}
    except Exception as error:
        return print("(check_script) Failed finding balance {}".format(error))