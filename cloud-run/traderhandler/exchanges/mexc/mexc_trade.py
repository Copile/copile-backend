import requests
import time
import json
import sqlite3
import hmac
import hashlib
db_filename = '../../mira.db'

API_KEY = "mx0eNN8rB9ImMSAGMp"
API_SECRET = b"ab76fdee185d41daa541f75c510831bb"


def mexc():
    timestamp = str(int(time.time()))

    parameter = {
        "symbol": "AVAXUSDT",
        "price": 15,
        "vol": 1,
        "leverage": 10,
        "side": 1,
        "type": 1,
        "openType": 1,
    }
    message = API_KEY + timestamp + str(parameter)
    signature = str(hmac.new(API_SECRET, message.encode(), hashlib.sha256).hexdigest())
    print(signature)

    headers = {
        "ApiKey": API_KEY,
        "Request-Time": timestamp,
        "Signature": signature,
        "Content-Type": "application/json"
    }

    r = requests.get("https://contract.mexc.com/api/v1/private/order/submit", headers=headers)
    print(r.text)


mexc()
