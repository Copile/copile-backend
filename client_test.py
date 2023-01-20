import requests

url = "https://us-central1-miratrading-ltd.cloudfunctions.net/submitTrade/submitTrade"

payload = {
    'side': 'BUY',
    'symbol': 'BTCUSDT',
    'leverage': '10',
    'price': '20100',
}

r = requests.post(url, data=payload)
print(r.text)