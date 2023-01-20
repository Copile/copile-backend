import requests

# admin dash payload
trade_payload = {
    "side": "sell",
    "symbol": "BTCUSDT",
    "leverage": "10",
    "price": "18500"
}

upload_data = {
    "discord_id": "31321312312",
    "exchange_1": "bybit",
    "apiKey_1": "gRcv1qUwhsh0UP12dC",
    "secretKey_1": "DbqCFa7BflIEok5qEAq400uOtGOqDtzh2Ef9",
    "risk": "15",
    "current_exchange": "bybit",
}

send_call = requests.post("http://127.0.0.1:5000/send_call", json=trade_payload)
print(send_call.text)
