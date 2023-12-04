import time
import aiohttp
import hashlib
import hmac
import json
import base64
from urllib.parse import urlencode

api_config = {
    "host": "api-futures.kucoin.com",
    "protocol": "https"
}


def sign_request(str_to_sign, api_secret):
    signature = base64.b64encode(
        hmac.new(api_secret.encode('utf-8'), str_to_sign.encode('utf-8'), hashlib.sha256).digest()
    ).decode('utf-8')
    return signature


async def make_signed_request(method, path, payload, api_key, api_secret, api_passphrase):
    timestamp = str(int(time.time() * 1000))

    headers = {
        "Content-Type": "application/json",
        "KC-API-KEY": api_key,
        "KC-API-KEY-VERSION": "2",
        "KC-API-TIMESTAMP": timestamp
    }

    if method in ['GET', 'DELETE']:
        query_string = urlencode(payload) if payload else ''
        print(query_string)
        str_to_sign = f'{timestamp}{method}{path}?{query_string}'
        url = f"{api_config['protocol']}://{api_config['host']}{path}?{query_string}"
    else:
        str_to_sign = f'{timestamp}{method}{path}{json.dumps(payload)}'
        url = f"{api_config['protocol']}://{api_config['host']}{path}"

    signature = sign_request(str_to_sign, api_secret)
    headers['KC-API-SIGN'] = signature
    print(url)
    passphrase = base64.b64encode(
        hmac.new(api_secret.encode('utf-8'), api_passphrase.encode('utf-8'), hashlib.sha256).digest()
    ).decode('utf-8')
    headers['KC-API-PASSPHRASE'] = passphrase
    print(headers)
    async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl=False)) as session:
        async with session.request(method, url, headers=headers,
                                   data=payload if method not in ['GET', 'DELETE'] else None) as response:
            print(response)
            if response.status != 200:
                raise Exception(f"Failed to send Kucoin API request to {path}: {response.reason}")
            data = await response.json()
            return data
