import sqlite3
import datetime
import json

db_filename = '../../mira.db'


class balances:
    id = 0
    license_key = 1
    balance = 2
    date = 3
    type = 4


b = balances()


def daily_balances(license_key, amount):
    with sqlite3.connect(database=db_filename, check_same_thread=False) as database:
        cursor = database.cursor()
        dates = []
        balances = []
        for row in cursor.execute(
                f'SELECT * FROM balances WHERE license_key = {license_key} ORDER BY id DESC LIMIT {amount}'):
            balance_date = datetime.datetime.fromtimestamp(int(row[b.date])).strftime('%Y-%d-%m')
            if balance_date not in dates:
                dates.append(balance_date)
                balances.append(row[b.balance])
        y = {
            'license_key': license_key,
            'dates': dates,
            'balances': balances
        }
        json_balances = json.dumps(y)
        return json_balances


def monthly_balances(license_key):
    with sqlite3.connect(database=db_filename, check_same_thread=False) as database:
        cursor = database.cursor()
        months = []
        last_balance = []
        for row in cursor.execute(f'SELECT * FROM balances WHERE license_key = {license_key} ORDER BY id DESC'):
            balance_month = datetime.datetime.fromtimestamp(int(row[b.date])).strftime('%m')
            if balance_month not in months:
                months.append(balance_month)
                last_balance.append(str(round(float(row[b.balance]), 2)))
        y = {
            'license_key': license_key,
            'months': months,
            'balances': last_balance,
        }
        json_balances = json.dumps(y)
        return json_balances
