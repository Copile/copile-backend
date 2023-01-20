import _thread
import sqlite3
import time
from binance.client import Client
from pybit import HTTP

from backend.exchanges.binance import binance
from backend.exchanges.binance import binance_cancel
from backend.exchanges.binance import binance_order
from backend.exchanges.binance import binance_profit
from backend.exchanges.binance import binance_stoploss
from backend.exchanges.bybit import bybit
from backend.exchanges.bybit import bybit_cancel
from backend.exchanges.bybit import bybit_order
from backend.exchanges.bybit import bybit_profit
from backend.exchanges.bybit import bybit_stoploss

db_filename = '../mira.db'

discord_id = 0
exchange_1 = 1
apiKey_1 = 2
secretKey_1 = 3
exchange_2 = 4
apiKey_2 = 5
secretKey_2 = 6
risk = 7

trade_ID = 0
call = 1
discord = 3
type1 = 4
executed = 5
exchange = 6


def start(side, symbol, leverage, price):
    data = [symbol, price, side, time.time()]
    sql_insert_query = '''INSERT INTO calls(coin,entry,side,date) VALUES(?,?,?,?)'''
    try:
        with sqlite3.connect(db_filename, check_same_thread=False) as database:
            cursor = database.cursor()
            cursor.execute(sql_insert_query, data)
            database.commit()
            cursor.execute("SELECT * FROM calls ORDER BY call_ID DESC LIMIT 1")
            result = cursor.fetchone()
            call_id = result[0]
            for row in cursor.execute("SELECT * FROM members"):
                if row[exchange_1] == "bybit":
                    try:
                        _thread.start_new_thread(start_bybit, (
                            call_id, cursor, database, leverage, price, side, symbol, row[discord_id], row[risk],
                            row[apiKey_1],
                            row[secretKey_1]))
                    except Exception as e:
                        print(e)
                        try:
                            if row[exchange_2] == "binance":
                                _thread.start_new_thread(start_binance, (
                                    call_id, cursor, database, leverage, price, side, symbol, row[discord_id],
                                    row[risk],
                                    row[apiKey_2], row[secretKey_2]))
                        except Exception as e:
                            print(f'{e} - {row[discord_id]}')
                if row[exchange_1] == "binance":
                    try:
                        _thread.start_new_thread(start_binance, (call_id, cursor, database, leverage, price, side,
                                                                 symbol, row[discord_id], row[risk], row[apiKey_1],
                                                                 row[secretKey_1]))
                    except Exception as e:
                        if row[exchange_2] == "bybit":
                            try:
                                _thread.start_new_thread(start_bybit, (
                                    call_id, cursor, database, leverage, price, side, symbol, row[discord_id],
                                    row[risk],
                                    row[apiKey_2],
                                    row[secretKey_2]))
                            except Exception as e:
                                print(f'{e} - {row[discord_id]}')
    except Exception as error:
        print("(start) Data insertion failed {}".format(error))


def start_bybit(call_id, cursor, database, leverage, price, side, symbol, member, margin, api_key, secret_key):
    session = HTTP(
        endpoint='https://api.bybit.com',
        api_key=api_key,
        api_secret=secret_key
    )
    # check = session.public_trading_records(
    #    symbol=symbol,
    #    limit=1
    # )
    _thread.start_new_thread(bybit, (
        side, symbol, leverage, margin, price, api_key, secret_key, member))
    data = [call_id, member, side, "Yes", "bybit"]
    sql_insert_query = '''INSERT INTO trades(call_ID,discord_ID,side,executed,exchange) 
                                    VALUES(?,?,?,?,?) '''
    try:
        cursor.execute(sql_insert_query, data)
        database.commit()
        print("Opened Trade ID:" + str(call_id))
    except Exception as error:
        print("(start_bybit) Data insertion failed {}".format(error))


def start_binance(call_id, cursor, database, leverage, price, side, symbol, member, margin, api_key, secret_key):
    client = Client(api_key, secret_key)
    check = client.get_recent_trades(
        symbol=symbol,
        limit=1
    )
    _thread.start_new_thread(binance, (
        side, symbol, leverage, margin, price, api_key, secret_key, member))
    data = [call_id, member, side, "Yes", "binance"]
    sql_insert_query = '''INSERT INTO trades(call_ID,discord_ID,side,executed,exchange) 
                                VALUES(?,?,?,?,?) '''
    try:
        cursor.execute(sql_insert_query, data)
        database.commit()
        print("Opened Trade ID:" + call_id)
    except Exception as error:
        print("Data insertion failed {}".format(error))


def take_profits(side, symbol, leverage, price, tps, call_id):
    try:
        with sqlite3.connect(db_filename, check_same_thread=False) as database:
            cursor = database.cursor()
            for row in cursor.execute("SELECT * FROM members"):
                for row1 in cursor.execute(f"SELECT * FROM trades WHERE discord_ID = {row[discord_id]}"):
                    if row[call] == call_id and row1[executed] == "Yes":
                        if row1[exchange] == "bybit":
                            api_key = row[apiKey_1] if row[exchange_1] == "bybit" else row[apiKey_2]
                            secret_key = row[secretKey_1] if row[exchange_1] == "bybit" else row[secretKey_2]
                            _thread.start_new_thread(bybit_profit, (
                                side, symbol, leverage, row[risk], price, tps, api_key, secret_key,
                                call_id,
                                row[discord_id]))
                        if row1[exchange] == "binance":
                            api_key = row[apiKey_1] if row[exchange_1] == "binance" else row[apiKey_2]
                            secret_key = row[secretKey_1] if row[exchange_1] == "binance" else row[secretKey_2]
                            _thread.start_new_thread(binance_profit, (
                                side, symbol, leverage, row[risk], price, tps, api_key, secret_key,
                                call_id,
                                row[discord_id]))
                    else:
                        print("Call not found.")
    except Exception as error:
        print("Couldn't fetch data {}".format(error))


def stop_loss(side, symbol, leverage, price, stoploss, call_id):
    try:
        with sqlite3.connect(db_filename, check_same_thread=False) as database:
            cursor = database.cursor()
            for row in cursor.execute("SELECT * FROM members"):
                for row1 in cursor.execute(f"SELECT * FROM trades WHERE discord_ID = {row[discord_id]}"):
                    if row[call] == call_id and row1[executed] == "Yes":
                        if row1[exchange] == "bybit":
                            api_key = row[apiKey_1] if row[exchange_1] == "bybit" else row[apiKey_2]
                            secret_key = row[secretKey_1] if row[exchange_1] == "bybit" else row[secretKey_2]
                            _thread.start_new_thread(bybit_stoploss, (
                                side, symbol, leverage, row[risk], price, stoploss, api_key, secret_key,
                                call_id,
                                row[discord_id]))
                        if row1[exchange] == "binance":
                            api_key = row[apiKey_1] if row[exchange_1] == "binance" else row[apiKey_2]
                            secret_key = row[secretKey_1] if row[exchange_1] == "binance" else row[secretKey_2]
                            _thread.start_new_thread(binance_stoploss, (
                                side, symbol, leverage, row[risk], price, stoploss, api_key, secret_key,
                                call_id,
                                row[discord_id]))
                    else:
                        print("Call not found.")
    except Exception as error:
        print("Couldn't fetch data {}".format(error))


def send_cancel(symbol, call_id):
    try:
        with sqlite3.connect(db_filename, check_same_thread=False) as database:
            cursor = database.cursor()
            for row in cursor.execute("SELECT * FROM members"):
                for row1 in cursor.execute(f"SELECT * FROM trades WHERE discord_ID = {row[discord_id]}"):
                    if row[call] == call_id and row1[executed] == "Yes":
                        if row1[exchange] == "bybit":
                            api_key = row[apiKey_1] if row[exchange_1] == "bybit" else row[apiKey_2]
                            secret_key = row[secretKey_1] if row[exchange_1] == "bybit" else row[secretKey_2]
                            _thread.start_new_thread(bybit_cancel,
                                                     (row1[type1], symbol, api_key, secret_key,
                                                      call_id))
                        if row1[exchange] == "binance":
                            api_key = row[apiKey_1] if row[exchange_1] == "binance" else row[apiKey_2]
                            secret_key = row[secretKey_1] if row[exchange_1] == "binance" else row[secretKey_2]
                            _thread.start_new_thread(binance_cancel,
                                                     (row1[type1], symbol, api_key, secret_key,
                                                      call_id))
                    else:
                        print("Call not found.")
    except Exception as error:
        print("Couldn't fetch data {}".format(error))


def cancel_order(symbol, call_id, name):
    try:
        with sqlite3.connect(db_filename, check_same_thread=False) as database:
            cursor = database.cursor()
            for row in cursor.execute("SELECT * FROM members"):
                for row1 in cursor.execute(f"SELECT * FROM trades WHERE discord_ID = {row[discord_id]}"):
                    if row[call] == call_id and row1[executed] == "Yes":
                        if row1[exchange] == "bybit":
                            api_key = row[apiKey_1] if row[exchange_1] == "bybit" else row[apiKey_2]
                            secret_key = row[secretKey_1] if row[exchange_1] == "bybit" else row[secretKey_2]
                            _thread.start_new_thread(bybit_order, (
                                symbol, call_id, name, api_key, secret_key, row[discord_id]))
                        if row1[exchange] == "binance":
                            api_key = row[apiKey_1] if row[exchange_1] == "binance" else row[apiKey_2]
                            secret_key = row[secretKey_1] if row[exchange_1] == "binance" else row[secretKey_2]
                            _thread.start_new_thread(binance_order, (
                                symbol, call_id, name, api_key, secret_key, row[discord_id]))
                    else:
                        print("Call not found.")
    except Exception as error:
        print("Couldn't fetch data {}".format(error))
