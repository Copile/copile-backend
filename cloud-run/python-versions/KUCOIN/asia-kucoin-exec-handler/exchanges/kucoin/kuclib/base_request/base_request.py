import json
import aiohttp
import hmac
import hashlib
import base64
import time
from uuid import uuid1
from urllib.parse import urljoin

class KucoinBaseRestApi(object):

    def __init__(self, key='', secret='', passphrase='', is_sandbox=False, url='', is_v1api=False):
        if url:
            self.url = url
        else:
            if is_sandbox:
                self.url = 'https://openapi-sandbox.kucoin.com'
            else:
                self.url = 'https://api-futures.kucoin.com'

        self.key = key
        self.secret = secret
        self.passphrase = passphrase
        self.is_v1api = is_v1api

    async def _request(self, method, uri, timeout=5, auth=True, params=None):
        uri_path = uri
        data_json = ''
        if method in ['GET', 'DELETE']:
            if params:
                strl = []
                for key in sorted(params):
                    strl.append("{}={}".format(key, params[key]))
                data_json += '&'.join(strl)
                uri += '?' + data_json
                uri_path = uri
        else:
            if params:
                data_json = json.dumps(params)
                uri_path = uri + data_json

        headers = {}
        if auth:
            now_time = int(time.time()) * 1000
            str_to_sign = str(now_time) + method + uri_path
            sign = base64.b64encode(
                hmac.new(self.secret.encode('utf-8'), str_to_sign.encode('utf-8'), hashlib.sha256).digest()
            ).decode('utf-8')  # Decode to string

            if self.is_v1api:
                headers = {
                    "KC-API-SIGN": sign,
                    "KC-API-TIMESTAMP": str(now_time),
                    "KC-API-KEY": self.key,
                    "KC-API-PASSPHRASE": self.passphrase,
                    "Content-Type": "application/json"
                }
            else:
                passphrase = base64.b64encode(
                    hmac.new(self.secret.encode('utf-8'), self.passphrase.encode('utf-8'), hashlib.sha256).digest()
                ).decode('utf-8')  # Decode to string
                headers = {
                    "KC-API-SIGN": sign,
                    "KC-API-TIMESTAMP": str(now_time),
                    "KC-API-KEY": self.key,
                    "KC-API-PASSPHRASE": passphrase,
                    "Content-Type": "application/json",
                    "KC-API-KEY-VERSION": "2"
                }

        headers["User-Agent"] = "kucoin-python-sdk/"
        url = urljoin(self.url, uri)

        async with aiohttp.ClientSession() as session:
            if method in ['GET', 'DELETE']:
                async with session.request(method, url, headers=headers, timeout=timeout) as resp:
                    return await self.check_response_data(resp)
            else:
                async with session.request(method, url, headers=headers, data=data_json, timeout=timeout) as resp:
                    return await self.check_response_data(resp)

    @staticmethod
    async def check_response_data(response_data):
        if response_data.status == 200:
            try:
                data = await response_data.json()
            except ValueError:
                raise Exception(await response_data.text())
            else:
                if data and data.get('code'):
                    if data.get('code') == '200000':
                        if data.get('data'):
                            return data['data']
                        else:
                            return data
                    else:
                        raise Exception(f"{response_data.status}-{await response_data.text()}")
        else:
            raise Exception(f"{response_data.status}-{await response_data.text()}")

    @property
    def return_unique_id(self):
        return ''.join([each for each in str(uuid1()).split('-')])
