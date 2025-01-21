from .request import make_signed_request
from ..scripts.settings import create_client_oid


class KucoinFunctions:
    def __init__(self, api_key, api_secret, api_passphrase):
        self.api_key = api_key
        self.api_secret = api_secret
        self.api_passphrase = api_passphrase

    async def trade_order(self, order):
        # https://www.kucoin.com/docs/rest/futures-trading/orders/place-order
        path = "/api/v1/orders"
        order.remove_none_attributes()
        payload = {**order.__dict__, 'clientOid': create_client_oid()}
        return await make_signed_request("POST", path, payload, self.api_key, self.api_secret, self.api_passphrase)

    async def get_position(self, symbol):
        # https://www.kucoin.com/docs/rest/futures-trading/positions/get-position-details
        path = "/api/v1/position"
        payload = {"symbol": symbol}
        response = await make_signed_request("GET", path, payload, self.api_key, self.api_secret, self.api_passphrase)
        return response

    async def get_balance(self):
        # https://www.kucoin.com/docs/rest/funding/funding-overview/get-account-detail-margin
        path = "/api/v1/margin/account"
        response = await make_signed_request("GET", path, None, self.api_key, self.api_secret)
        for account in response['accounts']:
            if account['currency'] == "USDT":
                return account['availableBalance']

    async def cancel_all_orders(self, symbol):
        # https://docs.kucoin.com/#cancel-all-orders
        path = "/api/v1/stopOrders"
        payload = {'symbol': symbol}
        return await make_signed_request("DELETE", path, payload, self.api_key, self.api_secret, self.api_passphrase)

    async def cancel_order(self, order_id):
        # https://www.kucoin.com/docs/rest/futures-trading/orders/cancel-futures-order-by-orderid
        path = f"/api/v1/orders/{order_id}"
        return await make_signed_request("DELETE", path, None, self.api_key, self.api_secret, self.api_passphrase)

    async def current_orders(self, symbol):
        # https://www.kucoin.com/docs/rest/futures-trading/orders/get-order-list
        path = "/api/v1/orders"
        payload = {'status': "active", 'symbol': symbol}
        response = await make_signed_request("GET", path, payload, self.api_key, self.api_secret, self.api_passphrase)
        return response['items']

    async def get_market(self, symbol):
        # https://www.kucoin.com/docs/rest/futures-trading/market-data/get-ticker
        path = "/api/v1/ticker"
        payload = {"symbol": symbol}
        response = await make_signed_request("GET", path, payload, self.api_key, self.api_secret, self.api_passphrase)
        return float(response["price"])

    async def get_precisions(self, symbol):
        # https://www.kucoin.com/docs/rest/futures-trading/market-data/get-symbol-detail
        path = f"/api/v1/contracts/{symbol}"
        payload = {}
        response = await make_signed_request("GET", path, None, self.api_key, self.api_secret, self.api_passphrase)
        multiplier = response['multiplier']
        min_qty = 1 * float(multiplier)
        quantity_precision = int(len(str(min_qty).split(".")[1])) if min_qty != 1 else 0
        price_precision = int(len(str(response['tickSize']).split('.')[1]))
        return {'quantity_precision': int(quantity_precision), 'price_precision': int(price_precision),
                'min_qty': float(min_qty), 'multiplier': float(multiplier)}
