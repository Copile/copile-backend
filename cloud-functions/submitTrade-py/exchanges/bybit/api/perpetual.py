from .request import make_signed_request
import json

category = "linear"


class BybitFunctions:
    def __init__(self, api_key, api_secret):
        self.api_key = api_key
        self.api_secret = api_secret

    async def trade_order(self, order):
        path = "/v5/order/create"
        order.remove_none_attributes()
        payload = order.__dict__
        payload['category'] = category
        return make_signed_request("POST", path, payload, self.api_key, self.api_secret)

    async def cancel_order(self, symbol, order_id, order_link_id):
        path = "/v5/order/cancel"
        payload = {
            'category': category,
            'symbol': symbol,
            'orderId' if order_id is not None else 'orderLinkId': order_id if order_id is not None else order_link_id
        }
        return await make_signed_request("POST", path, payload, self.api_key, self.api_secret)

    async def current_orders(self, symbol):
        path = "/v5/order/realtime"
        payload = {'category': category, 'symbol': symbol}
        return await make_signed_request("GET", path, payload, self.api_key, self.api_secret)

    async def cancel_all_orders(self, symbol):
        path = "/v5/order/cancel-all"
        payload = {'category': category, 'symbol': symbol}
        return await make_signed_request("GET", path, payload, self.api_key, self.api_secret)


