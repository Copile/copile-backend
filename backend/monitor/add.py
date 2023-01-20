import csv
import time
import pandas as pd
from pybit import HTTP

CSVs = ['prices_bybit.csv', 'prices_binance.csv']


def add(coin, side):
    # Adding Coin to all monitor CSV-files
    for i in CSVs:
        number = -1
        with open(i, newline='') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                number = number + 1
            df = pd.read_csv(i)
            df.loc[number + 1, 'coin'] = str(coin)
            df.to_csv(i, index=False)
            print(f"Added Coin - {coin}")

    # Adding Coin to calls list for further use
    with open("calls.csv", newline='') as csvfile:
        reader = csv.DictReader(csvfile)
        number = -1
        for row in reader:
            number = number + 1
            if row['coin'] == "":
                try:
                    df = pd.read_csv('calls.csv')
                    df.loc[number, 'coin'] = str(coin)
                    df.loc[number, 'side'] = str(side)
                    df.to_csv('calls.csv', index=False)
                    print(f"Added Coin to calls list - {coin}")
                except Exception as error:
                    df = pd.read_csv('calls.csv')
                    df.loc[number + 1, 'coin'] = str(coin)
                    df.loc[number + 1, 'side'] = str(side)
                    df.to_csv('calls.csv', index=False)
                    print(f"Added Coin to calls list - {coin}")
