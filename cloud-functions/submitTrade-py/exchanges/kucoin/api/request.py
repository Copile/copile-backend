import time
import aiohttp
import hashlib
import hmac
from urllib.parse import urlencode

api_config = {
    "host": "api-futures.kucoin.com",
    "protocol": "https"
}

recv_window = 5000


# Function to create signature for request based on payload
def sign_request(params, api_secret):
    encoded_params = urlencode(params)
    signature = hmac.new(api_secret.encode(), encoded_params.encode(), hashlib.sha256).hexdigest()
    return signature


# Function to send the request to Kucoin
async def make_signed_request(method, path, payload, api_key, api_secret, api_passphrase):
    timestamp = str(int(time.time() * 1000))
    payload['timestamp'] = timestamp

    params = payload.copy()
    signature = sign_request(params, api_secret)
    params['signature'] = signature

    url = f"{api_config['protocol']}://{api_config['host']}{path}?{urlencode(params)}"
    print(url)

    headers = {
        "Content-Type": "application/json",
        "X-BAPI-API-KEY": api_key,
        "KC-API-PASSPHRASE": api_passphrase,
        "KC-API-SIGN": signature,
        "KC-API-TIMESTAMP": timestamp,
        "KC-API-KEY-VERSION": "2",
    }

    conn = aiohttp.TCPConnector(ssl=True)
    async with aiohttp.ClientSession(connector=conn) as session:
        async with session.request(method, url, headers=headers) as response:
            if response.status != 200:
                raise Exception(f"Failed to send Kucoin API request to {path}: {response.reason}")
            data = await response.json()
            return data
