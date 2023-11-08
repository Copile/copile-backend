import json
import logging
from json import JSONDecodeError
import aiohttp  # replacing requests with aiohttp
from .__version__ import __version__
from .error import ClientError, ServerError
from .lib.utils import get_timestamp
from .lib.utils import cleanNoneValue
from .lib.utils import encoded_string
from .lib.utils import check_required_parameter
from .lib.authentication import hmac_hashing, rsa_signature


class API(object):

    def __init__(self, key=None, secret=None, base_url=None, timeout=None, proxies=None, show_limit_usage=False, show_header=False, private_key=None, private_key_passphrase=None):
        self.key = key
        self.secret = secret
        self.timeout = timeout
        self.show_limit_usage = False
        self.show_header = False
        self.proxies = None
        self.private_key = private_key
        self.private_key_pass = private_key_passphrase
        self.headers = {
            "Content-Type": "application/json;charset=utf-8",
            "User-Agent": "binance-futures-connector-python/" + __version__,
            "X-MBX-APIKEY": key,
        }

        if base_url:
            self.base_url = base_url

        if show_limit_usage is True:
            self.show_limit_usage = True

        if show_header is True:
            self.show_header = True

        if type(proxies) is dict:
            self.proxies = proxies

    async def query(self, url_path, payload=None):
        return await self.send_request("GET", url_path, payload=payload)

    async def limit_request(self, http_method, url_path, payload=None):
        check_required_parameter(self.key, "apiKey")
        return await self.send_request(http_method, url_path, payload=payload)

    async def sign_request(self, http_method, url_path, payload=None, special=False):
        if payload is None:
            payload = {}
        payload["timestamp"] = get_timestamp()
        query_string = self._prepare_params(payload, special)
        payload["signature"] = self._get_sign(query_string)
        return await self.send_request(http_method, url_path, payload, special)

    async def limited_encoded_sign_request(self, http_method, url_path, payload=None):
        if payload is None:
            payload = {}
        payload["timestamp"] = get_timestamp()
        query_string = self._prepare_params(payload)
        url_path = url_path + "?" + query_string + "&signature=" + self._get_sign(query_string)
        return await self.send_request(http_method, url_path)

    async def send_request(self, http_method, url_path, payload=None, special=False):
        if payload is None:
            payload = {}
        url = self.base_url + url_path
        logging.debug("url: " + url)
        params = cleanNoneValue({
            "url": url,
            "params": self._prepare_params(payload, special),
            "timeout": self.timeout,
            "proxies": self.proxies,
        })
        async with aiohttp.ClientSession(headers=self.headers) as session:
            async with session.request(http_method, url, params=params['params'], proxy=params.get('proxies')) as response:
                response_text = await response.text()
                print(response_text)
                logging.debug("raw response from server:" + response_text)
                self._handle_exception(response)
                try:
                    data = await response.json()
                except ValueError:
                    data = response_text

                result = {}

                if self.show_limit_usage:
                    limit_usage = {}
                    for key in response.headers.keys():
                        key = key.lower()
                        if key.startswith("x-mbx-used-weight") or key.startswith("x-mbx-order-count") or key.startswith("x-sapi-used"):
                            limit_usage[key] = response.headers[key]
                    result["limit_usage"] = limit_usage

                if self.show_header:
                    result["header"] = response.headers

                if len(result) != 0:
                    result["data"] = data
                    return result

                return data

    def _prepare_params(self, params, special=False):
        return encoded_string(cleanNoneValue(params), special)

    def _get_sign(self, payload):
        if self.private_key:
            return rsa_signature(self.private_key, payload, self.private_key_pass)
        return hmac_hashing(self.secret, payload)

    def _handle_exception(self, response):
        status_code = response.status
        if status_code < 400:
            return
        if 400 <= status_code < 500:
            try:
                err = json.loads(response.text)
            except JSONDecodeError:
                raise ClientError(status_code, None, response.text, response.headers)
            raise ClientError(status_code, err["code"], err["msg"], response.headers)
        raise ServerError(status_code, response.text)
