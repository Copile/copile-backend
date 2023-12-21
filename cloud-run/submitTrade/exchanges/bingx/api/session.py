from trade.exchange_session import ExchangeSession
from ..execution import bulk_order, cancel_all_orders, replace_sl, cancel_all_tps, bulk_tp, partial_close, send_sl, \
    cancel_order

class BingXSession(ExchangeSession):
    """
    Represents a BingX exchange session.
    Extends ExchangeSession.
    """

    def __init__(self, api_key, api_secret):
        """
        Creates a BingXSession instance.
        :param apiKey: API key for the BingX session.
        :param apiSecret: API secret for the BingX session.
        """
        super().__init__(api_key, api_secret)

    async def bulk_order(self, data):
        return await bulk_order(self.api_key, self.api_secret, data)

    async def cancel_all_orders(self, data):
        return await cancel_all_orders(self.api_key, self.api_secret, data)

    async def replace_sl(self, data):
        return await replace_sl(self.api_key, self.api_secret, data)

    async def cancel_all_tps(self, data):
        return await cancel_all_tps(self.api_key, self.api_secret, data)

    async def bulk_tp(self, data):
        return await bulk_tp(self.api_key, self.api_secret, data)

    async def partial_close(self, data):
        return await partial_close(self.api_key, self.api_secret, data)

    async def send_sl(self, data):
        return await send_sl(self.api_key, self.api_secret, data)

    async def cancel_order(self, data):
        return await cancel_order(self.api_key, self.api_secret, data)