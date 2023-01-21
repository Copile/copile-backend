import sqlite3
from backend.balance.check import check_bybit, check_binance
import time

db_filename = '../../mira.db'


def first_balance(license_key, exchange, apikey, secretkey):
    with sqlite3.connect(db_filename, check_same_thread=False) as database:
        cursor = database.cursor()
        sql_insert_query = '''INSERT INTO balances(license_key,balance,date,type) VALUES(?,?,?,?)'''
        balance = eval("check_" + f"{exchange}(apikey, secretkey)")
        data = [str(license_key), str(balance), str(int(time.time())), "first"]
        cursor.execute(sql_insert_query, data)
        database.commit()
        database.close()