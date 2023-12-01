import time
import aiohttp
import hashlib
import hmac
from urllib.parse import urlencode

api_config = {
    "host": "fapi.binance.com",
    "protocol": "https"
}

recv_window = 5000


# Function to create signature for request based on payload
def sign_request(params, api_secret):
    encoded_params = urlencode(params)
    signature = hmac.new(api_secret.encode(), encoded_params.encode(), hashlib.sha256).hexdigest()
    return signature


# Function to send the request to BingX
async def make_signed_request(method, path, payload, api_key, api_secret):
    timestamp = str(int(time.time() * 1000))
    payload['timestamp'] = timestamp

    params = payload.copy()
    signature = sign_request(params, api_secret)
    params['signature'] = signature

    url = f"{api_config['protocol']}://{api_config['host']}{path}?{urlencode(params)}"
    print(url)
    headers = {
        "X-MBX-APIKEY": api_key,
    }

    conn = aiohttp.TCPConnector(ssl=True)
    async with aiohttp.ClientSession(connector=conn) as session:
        async with session.request(method, url, headers=headers) as response:
            if response.status != 200:
                raise Exception(f"Failed to send BingX API request to {path}: {response.reason}")
            data = await response.json()
            return data['result']
