from .request import make_signed_request
import json

category = "linear"


class BybitFunctions:
    def __init__(self, api_key, api_secret):
        self.api_key = api_key
        self.api_secret = api_secret

    async def trade_order(self, order):
        # https://bybit-exchange.github.io/docs/v5/order/create-order
        path = "/v5/order/create"
        order.remove_none_attributes()
        payload = order.__dict__
        payload['category'] = category
        return make_signed_request("POST", path, payload, self.api_key, self.api_secret)

    async def cancel_order(self, symbol, order_id, order_link_id):
        # https://bybit-exchange.github.io/docs/v5/order/cancel-order
        path = "/v5/order/cancel"
        payload = {
            'category': category,
            'symbol': symbol,
            'orderId' if order_id is not None else 'orderLinkId': order_id if order_id is not None else order_link_id
        }
        return await make_signed_request("POST", path, payload, self.api_key, self.api_secret)

    async def current_orders(self, symbol):
        # https://bybit-exchange.github.io/docs/v5/order/open-order
        path = "/v5/order/realtime"
        payload = {'category': category, 'symbol': symbol}
        return await make_signed_request("GET", path, payload, self.api_key, self.api_secret)

    async def cancel_all_orders(self, symbol):
        # https://bybit-exchange.github.io/docs/v5/order/cancel-all
        path = "/v5/order/cancel-all"
        payload = {'category': category, 'symbol': symbol}
        return await make_signed_request("GET", path, payload, self.api_key, self.api_secret)

    async def batch_order(self, orders):
        # https://bybit-exchange.github.io/docs/v5/order/batch-place
        path = "/v5/order/create-batch"
        payload = {'category': category, "request": orders}
        return await make_signed_request("POST", path, payload, self.api_key, self.api_secret)

    async def cancel_orders(self, orders):
        # https://bybit-exchange.github.io/docs/v5/order/batch-cancel
        path = "/v5/order/cancel-batch"
        payload = {'category': category, "request": orders}
        return await make_signed_request("POST", path, payload, self.api_key, self.api_secret)

    async def get_position(self, symbol):
        # https://bybit-exchange.github.io/docs/v5/position
        path = "/v5/position/list"
        payload = {'category': category, "symbol": symbol}
        return await make_signed_request("GET", path, payload, self.api_key, self.api_secret)

    async def set_leverage(self, symbol, leverage):
        # https://bybit-exchange.github.io/docs/v5/position/leverage
        path = "/v5/position/set-leverage"
        payload = {'category': category, "symbol": symbol, "buyLeverage": str(leverage), "sellLeverage": str(leverage)}
        return await make_signed_request("POST", path, payload, self.api_key, self.api_secret)

