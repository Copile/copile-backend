import time
import aiohttp
import hashlib
import hmac
from urllib.parse import urlencode
import json

api_config = {
    "host": "api-testnet.bybit.com",
    "protocol": "https"
}

recv_window = 5000


# Function to create signature for request based on payload
def sign_request(api_key, api_secret, timestamp, payload, recv_window):
    encoded_params = timestamp + api_key + str(recv_window) + payload
    return hmac.new(bytes(api_secret, "utf-8"), encoded_params.encode("utf-8"), hashlib.sha256).hexdigest()


# Function to prepare the payload
def prepare_payload(method, parameters):
    if method == "GET":
        return "&".join([f"{k}={v}" for k, v in sorted(parameters.items()) if v is not None])
    else:
        return json.dumps(parameters)


# Function to send the request to Bybit
async def make_signed_request(method, path, payload, api_key, api_secret):
    timestamp = str(int(time.time() * 10 ** 3))
    params = prepare_payload(method, payload)
    signature = sign_request(api_key, api_secret, timestamp, params, str(recv_window))

    url = f"{api_config['protocol']}://{api_config['host']}{path}"
    if method == "GET":
        url += f"?{params}"

    headers = {
        "Content-Type": "application/json",
        "X-BAPI-API-KEY": api_key,
        "X-BAPI-SIGN": signature,
        "X-BAPI-SIGN-TYPE": "2",
        "X-BAPI-TIMESTAMP": timestamp,
        "X-BAPI-RECV-WINDOW": str(recv_window)
    }

    conn = aiohttp.TCPConnector(ssl=True)
    async with aiohttp.ClientSession(connector=conn) as session:
        async with session.request(method, url, headers=headers, data=params if method == "POST" else None) as response:
            if response.status != 200:
                raise Exception(f"Failed to send request to {path}: {response.reason}")
            response_json = await response.json()
            print(response_json)
            return response_json['result']
