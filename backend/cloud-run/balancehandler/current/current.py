import sqlite3
import time
from backend.balance.check import check_bybit, check_binance, members

db_filename = '../../mira.db'

m = members()


def check_current(exchange_1, apiKey_1, secretKey_1, exchange_2, apiKey_2, secretKey_2):
    if exchange_2 == "":
        balance = eval("check_" + f"{exchange_1}(apiKey_1, secretKey_1)")
        return balance
    else:
        balance1 = eval("check_" + f"{exchange_1}(apiKey_1, secretKey_1)")
        balance2 = eval("check_" + f"{exchange_2}(apiKey_2, secretKey_2)")
        balance = balance1 + balance2
        return balance


def current_balance(license_key, exchange, apikey, secretkey):
    with sqlite3.connect(db_filename, check_same_thread=False) as database:
        cursor = database.cursor()
        for row in cursor.execute(f"SELECT * FROM members WHERE discord_id = {license_key}"):
            check_current(row[m.exchange_1], row[m.apiKey_1], row[m.secretKey_1],
                                 "" if row[m.exchange_2] is None else row[m.exchange_2],
                                 "" if row[m.apiKey_2] is None else row[m.apiKey_2],
                                 "" if row[m.secretKey_2] is None else row[m.secretKey_2])
