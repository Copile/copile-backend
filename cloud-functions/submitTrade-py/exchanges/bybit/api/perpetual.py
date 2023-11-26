from request import make_signed_request

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
        return await make_signed_request("POST", path, payload, self.api_key, self.api_secret)

    async def modify_order(self, symbol, order_id, modification):
        # https://bybit-exchange.github.io/docs/v5/order/amend-order
        path = "/v5/order/amend"
        payload = {'category': category, 'symbol': symbol, 'order_id': order_id}
        payload.update(modification)
        return await make_signed_request("POST", path, payload, self.api_key, self.api_secret)

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
        response = await make_signed_request("GET", path, payload, self.api_key, self.api_secret)
        return response['list']

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

    async def switch_margin_mode(self, margin_mode):
        # https://bybit-exchange.github.io/docs/v5/account/set-margin-mode
        path = "/v5/account/set-margin-mode"
        payload = {'category': category, "setMarginMode": margin_mode}
        return await make_signed_request("POST", path, payload, self.api_key, self.api_secret)

    async def set_tp_sl_mode(self, symbol, tp_sl_mode):
        # https://bybit-exchange.github.io/docs/v5/position/tpsl-mode
        path = "/v5/position/set-tpsl-mode"
        payload = {'category': category, "symbol": symbol, "tpSlMode": tp_sl_mode}
        return await make_signed_request("POST", path, payload, self.api_key, self.api_secret)

    async def switch_position_mode(self, symbol, mode):
        # https://bybit-exchange.github.io/docs/v5/position/position-mode
        path = "/v5/position/switch-mode"
        payload = {'category': category, "symbol": symbol, "mode": mode}
        return await make_signed_request("POST", path, payload, self.api_key, self.api_secret)

    async def get_market(self, symbol):
        # https://bybit-exchange.github.io/docs/v5/market/tickers
        path = "/v5/market/tickers"
        payload = {'category': category, "symbol": symbol}
        response = await make_signed_request("GET", path, payload, self.api_key, self.api_secret)
        return response['list'][0]['markPrice']

    async def get_precisions(self, symbol):
        # https://bybit-exchange.github.io/docs/v5/market/instrument
        path = "/v5/market/instruments-info"
        payload = {'category': category, "symbol": symbol}
        response = await make_signed_request("GET", path, payload, self.api_key, self.api_secret)
        symbol_info = response['list'][0]
        price_precision = symbol_info['priceScale']
        quantity_precision = 0 if float(symbol_info["lotSizeFilter"]["qtyStep"]).is_integer() else int(
            len(str(symbol_info["lotSizeFilter"]["qtyStep"]).split(".")[1]))
        min_qty = symbol_info["lotSizeFilter"]['minOrderQty']
        return {'quantity_precision': int(quantity_precision), 'price_precision': int(price_precision),
                'min_qty': float(min_qty)}
