from .request import make_signed_request
import json


class BingXFunctions:
    def __init__(self, api_key, api_secret):
        self.api_key = api_key
        self.api_secret = api_secret

    async def trade_order(self, order):
        path = "/openApi/swap/v2/trade/order"
        order.remove_none_attributes()
        payload = order.__dict__
        return await make_signed_request("POST", path, payload, self.api_key, self.api_secret)

    async def bulk_order(self, batch_orders):
        path = "/openApi/swap/v2/trade/batchOrders"
        cleaned_batch_orders = [{k: v for k, v in order.items() if v is not None} for order in batch_orders]
        orders = json.dumps(cleaned_batch_orders)
        payload = {"batchOrders": orders}
        return await make_signed_request("POST", path, payload, self.api_key, self.api_secret)

    async def close_all_positions(self):
        path = "/openApi/swap/v2/trade/closeAllPositions"
        payload = {}
        return await make_signed_request("POST", path, payload, self.api_key, self.api_secret)

    async def cancel_order(self, symbol, order_id, client_order_id):
        path = "/openApi/swap/v2/trade/order"
        payload = {'symbol': symbol,
                   'orderId' if order_id is not None else 'clientOrderID': order_id if order_id is not None else client_order_id}
        return await make_signed_request("DELETE", path, payload, self.api_key, self.api_secret)

    async def cancel_orders(self, symbol, order_id_list, client_order_id_list):
        path = "/openApi/swap/v2/trade/batchOrders"
        payload = {'symbol': symbol}
        if order_id_list is not None:
            payload['orderIdList'] = order_id_list
        else:
            payload['ClientOrderIDList'] = client_order_id_list
        return await make_signed_request("DELETE", path, payload, self.api_key, self.api_secret)

    async def cancel_all_orders(self, symbol):
        path = "/openApi/swap/v2/trade/allOpenOrders"
        payload = {'symbol': symbol}
        return await make_signed_request("DELETE", path, payload, self.api_key, self.api_secret)

    async def current_orders(self, symbol):
        path = "/openApi/swap/v2/trade/openOrders"
        payload = {'symbol': symbol}
        return await make_signed_request("GET", path, payload, self.api_key, self.api_secret)

    async def get_order(self, symbol, order_id, client_order_id):
        path = "/openApi/swap/v2/trade/order"
        payload = {'symbol': symbol,
                   'orderId' if order_id is not None else 'clientOrderID': order_id if order_id is not None else client_order_id}
        return await make_signed_request("GET", path, payload, self.api_key, self.api_secret)

    async def margin_mode(self, symbol):
        path = "/openApi/swap/v2/trade/marginType"
        payload = {'symbol': symbol}
        return await make_signed_request("GET", path, payload, self.api_key, self.api_secret)

    async def switch_margin_mode(self, symbol, margin_type):
        path = "/openApi/swap/v2/trade/marginType"
        payload = {'symbol': symbol, 'marginType': margin_type}
        try:
            return await make_signed_request("POST", path, payload, self.api_key, self.api_secret)
        except Exception as error:
            print('Error in switch_margin_mode:', error)
            return None

    async def get_leverage(self, symbol):
        path = "/openApi/swap/v2/trade/leverage"
        payload = {'symbol': symbol}
        return await make_signed_request("GET", path, payload, self.api_key, self.api_secret)

    async def set_leverage(self, symbol, side, leverage):
        path = "/openApi/swap/v2/trade/leverage"
        leverage_side = "LONG" if side == "Buy" else "SHORT"
        payload = {'symbol': symbol, 'side': leverage_side, 'leverage': int(leverage)}
        return await make_signed_request("POST", path, payload, self.api_key, self.api_secret)

    async def force_orders(self, symbol=None, auto_close_type=None, start_time=None, end_time=None, limit=None):
        path = "/openApi/swap/v2/trade/forceOrders"
        payload = {'symbol': symbol, 'autoCloseType': auto_close_type, 'startTime': start_time, 'endTime': end_time,
                   'limit': limit}
        return await make_signed_request("GET", path, payload, self.api_key, self.api_secret)

    async def get_position(self, symbol):
        path = "/openApi/swap/v2/user/positions"
        payload = {'symbol': symbol}
        return await make_signed_request("GET", path, payload, self.api_key, self.api_secret)

    async def orders_history(self, symbol, order_id=None, start_time=None, end_time=None, limit=500):
        path = "/openApi/swap/v2/trade/allOrders"
        payload = {'symbol': symbol, 'orderId': order_id, 'startTime': start_time, 'endTime': end_time, 'limit': limit}
        return await make_signed_request("GET", path, payload, self.api_key, self.api_secret)

    async def get_market(self, symbol):
        path = "/openApi/swap/v2/quote/ticker"
        payload = {'symbol': symbol}
        response = await make_signed_request("GET", path, payload, self.api_key, self.api_secret)
        return response['lastPrice']

    async def get_precisions(self, symbol):
        path = "/openApi/swap/v2/quote/contracts"
        payload = {}
        try:
            precisions = await make_signed_request("GET", path, payload, self.api_key, self.api_secret)
            precisions_dict = {precision['symbol']: precision for precision in precisions}
            symbol_precision = precisions_dict.get(symbol, {})
            quantity_precision = symbol_precision.get('quantityPrecision')
            price_precision = symbol_precision.get('pricePrecision')
            min_qty = float(symbol_precision.get('size', 0))
            return {'quantity_precision': quantity_precision, 'price_precision': price_precision, 'min_qty': min_qty}
        except Exception as error:
            print('Error fetching precisions:', error)
            return {}

    async def adjust_isolated_margin(self, symbol, amount, type, position_side=None):
        path = "/openApi/swap/v2/trade/positionMargin"
        payload = {'symbol': symbol, 'amount': amount, 'type': type, 'positionSide': position_side}
        return await make_signed_request("POST", path, payload, self.api_key, self.api_secret)
