import time
import aiohttp
import hmac
import urllib
import base64

api = {
    'host': 'open-api.bingx.com',
    'protocol': 'https',
}

recvWindow = 10000

async def generate_timestamp():
    servertimeuri = '/openApi/swap/v2/server/time'
    url = f"{api['protocol']}://{api['host']}{servertimeuri}"
    
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            response_data = await response.json()
            return response_data['data']['serverTime']

class API(object):
    def __init__(self, api_key: str, api_secret: str, base_url: str, api_type: str=None):
        self.api_key    = api_key
        self.api_secret = api_secret
        self.base_url   = base_url
        self.api_type   = api_type

        self.headers = {
            'X-BX-APIKEY': self.api_key,
        }

    async def _handle_params(self, params, path=None, method=None):
        params = params or {}
        params['timestamp'] = await generate_timestamp()  # await the async function here
        if self.api_type == 'perpetual_v1':
            params['apiKey'] = self.api_key
            params = '&'.join(f'{k}={params[k]}' for k in sorted(params) if params[k])
        else:
            params = '&'.join(f'{k}={v}' for k, v in params.items() if v)
        params = params.replace(" ", "")
        params += self._signature(params, path, method)
        return params

    def _signature(self, params, path=None, method=None):
        if self.api_type != 'perpetual_v1':
            sign = hmac.new(self.api_secret.encode(), params.encode(), 'sha256')
            return f'&signature={sign.hexdigest()}'
        originString = f'{method}{path}{params}'
        sign = hmac.new(self.api_secret.encode(), originString.encode(), 'sha256')   
        return f'&sign={urllib.parse.quote(base64.b64encode(sign.digest()))}'

    async def _request(self, method, path, params=None, headers=None):
        url = f'{self.base_url}{path}?{await self._handle_params(params, path, method)}'  # await the async function here
        url = url.replace(" ", "")
        async with aiohttp.ClientSession() as session:
            if method == 'GET':
                async with session.get(url, headers=headers or self.headers) as response:
                    return await response.json()
            elif method == 'POST':
                async with session.post(url, headers=headers or self.headers) as response:
                    return await response.json()
            elif method == 'PUT':
                async with session.put(url, headers=headers or self.headers) as response:
                    return await response.json()
            elif method == 'DELETE':
                async with session.delete(url, headers=headers or self.headers) as response:
                    return await response.json()
            else:
                raise Exception('Invalid method: %s' % method)

    async def get(self, path, params=None):
        return await self._request('GET', path, params=params)

    async def post(self, path, params=None):
        return await self._request('POST', path, params=params)

    async def put(self, path, params=None):
        return await self._request('PUT', path, params=params)

    async def delete(self, path, params=None):
        return await self._request('DELETE', path, params=params)
