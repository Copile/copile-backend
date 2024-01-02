from .request import make_signed_request


class BinanceFunctions:
    def __init__(self, api_key, api_secret):
        self.api_key = api_key
        self.api_secret = api_secret

    async def trade_order(self, order):
        # https://binance-docs.github.io/apidocs/futures/en/#new-order-trade
        path = "/fapi/v1/order"
        order.remove_none_attributes()
        payload = {
            **order.__dict__,
        }
        return await make_signed_request("POST", path, payload, self.api_key, self.api_secret)

    async def batch_order(self, orders):
        # https://binance-docs.github.io/apidocs/futures/en/#place-multiple-orders-trade
        path = "/fapi/v1/batchOrders"
        payload = {"batchOrders": orders}
        return await make_signed_request("POST", path, payload, self.api_key, self.api_secret)

    async def get_position(self, symbol):
        # https://binance-docs.github.io/apidocs/futures/en/#position-information-v2-user_data
        path = "/fapi/v2/positionRisk"
        payload = {"symbol": symbol}
        response = await make_signed_request("GET", path, payload, self.api_key, self.api_secret)
        return response[0]

    async def get_balance(self):
        # https://binance-docs.github.io/apidocs/futures/en/#futures-account-balance-v2-user_data
        path = "/fapi/v2/balance"
        response = await make_signed_request("GET", path, None, self.api_key, self.api_secret)
        for account in response:
            if account['asset'] == "USDT":
                balance = account['availableBalance']
                return balance

    async def cancel_all_orders(self, symbol):
        # https://binance-docs.github.io/apidocs/futures/en/#cancel-all-open-orders-trade
        path = "/fapi/v1/allOpenOrders"
        payload = {'symbol': symbol}
        return await make_signed_request("DELETE", path, payload, self.api_key, self.api_secret)

    async def current_orders(self, symbol):
        # https://binance-docs.github.io/apidocs/futures/en/#query-current-open-order-user_data
        path = "/fapi/v1/openOrders"
        payload = {'symbol': symbol}
        response = await make_signed_request("GET", path, payload, self.api_key, self.api_secret)
        return response

    async def cancel_order(self, symbol, order_id, order_link_id):
        # https://binance-docs.github.io/apidocs/futures/en/#cancel-order-trade
        path = "/fapi/v1/order"
        payload = {
            'symbol': symbol,
            'orderId' if order_id is not None else 'origClientOrderId': order_id if order_id is not None else order_link_id
        }
        return await make_signed_request("DELETE", path, payload, self.api_key, self.api_secret)

    async def set_leverage(self, symbol, leverage):
        # https://binance-docs.github.io/apidocs/futures/en/#change-initial-leverage-trade
        path = "/fapi/v1/leverage"
        payload = {"symbol": symbol, "leverage": int(leverage)}
        return await make_signed_request("POST", path, payload, self.api_key, self.api_secret)

    async def switch_margin_mode(self, symbol, margin_mode):
        # https://binance-docs.github.io/apidocs/futures/en/#change-margin-type-trade
        path = "/fapi/v1/marginType"
        payload = {"symbol": symbol, "marginType": margin_mode}
        return await make_signed_request("POST", path, payload, self.api_key, self.api_secret)

    async def get_market(self, symbol):
        # https://binance-docs.github.io/apidocs/futures/en/#symbol-price-ticker
        path = "/fapi/v1/ticker/price"
        payload = {"symbol": symbol}
        response = await make_signed_request("GET", path, payload, self.api_key, self.api_secret)
        return float(response["price"])

    async def get_precisions(self, symbol):
        # https://binance-docs.github.io/apidocs/futures/en/#exchange-information
        path = "/fapi/v1/exchangeInfo"
        payload = {"symbol": symbol}
        response = await make_signed_request("GET", path, payload, self.api_key, self.api_secret)
        symbol_info = response['symbols']

        precision_dict = {
            item['symbol']: {
                'pricePrecision': item['pricePrecision'],
                'quantityPrecision': item['quantityPrecision'],
                'filters': {f['filterType']: f for f in item['filters']}
            }
            for item in symbol_info if item['symbol'] == symbol
        }

        price_precision, quantity_precision, filters = (
            precision_dict[symbol]['pricePrecision'],
            precision_dict[symbol]['quantityPrecision'],
            precision_dict[symbol]['filters']
        )

        min_qty = filters['LOT_SIZE']['minQty'] if 'LOT_SIZE' in filters else None

        return {'quantity_precision': int(quantity_precision), 'price_precision': int(price_precision),
                'min_qty': float(min_qty)}
