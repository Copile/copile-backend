import _thread
import sqlite3
import time
from binance.client import Client
from pybit.inverse_futures import HTTP
from threading import Thread

db_filename = '../../mira.db'


class members:
    discord_id = 0
    exchange_1 = 1
    apiKey_1 = 2
    secretKey_1 = 3
    exchange_2 = 4
    apiKey_2 = 5
    secretKey_2 = 6
    risk = 7


m = members()


def check(license_key, exchange_1, apiKey_1, secretKey_1, exchange_2, apiKey_2, secretKey_2):
    with sqlite3.connect(db_filename, check_same_thread=False) as database:
        cursor = database.cursor()
        sql_insert_query = '''INSERT INTO balances(license_key,balance,date,type) VALUES(?,?,?,?)'''
        if exchange_2 == "":
            balance = eval("check_" + f"{exchange_1}(apiKey_1, secretKey_1)")
            print(balance)
            data = [str(license_key), str(balance), str(int(time.time())), "check"]
            print(data)
            cursor.execute(sql_insert_query, data)
            database.commit()
        else:
            balance1 = eval("check_" + f"{exchange_1}(apiKey_1, secretKey_1)")
            balance2 = eval("check_" + f"{exchange_2}(apiKey_2, secretKey_2)")
            balance = balance1 + balance2
            data = [str(license_key), str(balance), str(int(time.time())), "check"]
            cursor.execute(sql_insert_query, data)
            print("Executed")
            database.commit()


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


def check_binance(api_key, secret_key):
    try:
        client = Client(api_key, secret_key)
        balance_search = client.futures_account_balance()
        balance = round(float(balance_search[6]['balance']), 2)
        return balance
    except Exception as error:
        return print("(check_binance) Failed finding balance {}".format(error))


def rotator():
    with sqlite3.connect(db_filename, check_same_thread=False) as database:
        cursor = database.cursor()
        for row in cursor.execute("SELECT * FROM members"):
            try:
                t = Thread(target=check,
                           args=(row[m.discord_id], row[m.exchange_1], row[m.apiKey_1], row[m.secretKey_1],
                                 "" if row[m.exchange_2] is None else row[m.exchange_2],
                                 "" if row[m.apiKey_2] is None else row[m.apiKey_2],
                                 "" if row[m.secretKey_2] is None else row[m.secretKey_2]))
                t.run()
            except Exception as e:
                print(f'{e} - {row[m.discord_id]}')


for i in range(100):
    rotator()
