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


def prepare_payload(method, parameters):
    def cast_values():
        string_params = [
            "qty",
            "price",
            "triggerPrice",
            "takeProfit",
            "stopLoss",
        ]
        integer_params = ["positionIdx"]
        for key, value in parameters.items():
            if key in string_params:
                if not isinstance(value, str):
                    parameters[key] = str(value)
            elif key in integer_params:
                if not isinstance(value, int):
                    parameters[key] = int(value)

    if method == "GET":
        payload = "&".join(
            [
                str(k) + "=" + str(v)
                for k, v in sorted(parameters.items())
                if v is not None
            ]
        )
        return payload
    else:
        cast_values()
        return json.dumps(parameters)


# Function to create signature for request based on payload
def sign_request(api_key, api_secret, payload, timestamp, recv_window):
    encoded_params = timestamp + api_key + recv_window + payload
    print(payload)
    signature = hmac.new(bytes(api_secret, "utf-8"), encoded_params.encode("utf-8"), hashlib.sha256).hexdigest()
    return signature


# Function to send the request to BingX
async def make_signed_request(method, path, payload, api_key, api_secret):
    timestamp = str(int(time.time() * 10 ** 3))
    params = prepare_payload(method, payload)
    signature = sign_request(api_key, api_secret, params, timestamp, str(recv_window))

    url = f"{api_config['protocol']}://{api_config['host']}{path}?{params}"

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
        async with session.request(method, url, headers=headers) as response:
            if response.status != 200:
                raise Exception(f"Failed to send BingX API request to {path}: {response.reason}")
            data = await response.json()
            print(data)
            return data['result']
