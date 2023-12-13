import logging
from trade.exchange_session import ExchangeSession
from ..execution import bulk_order, cancel_all_orders, replace_sl, cancel_all_tps, bulk_tp, partial_close, send_sl, \
    cancel_order

logger = logging.getLogger(__name__)


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
        try:
            return await bulk_order(self.api_key, self.api_secret, data)
        except Exception as e:
            logger.error(f"Failed to send bulk_order: {str(e)}", exc_info=True)
            raise

    async def cancel_all_orders(self, data):
        try:
            return await cancel_all_orders(self.api_key, self.api_secret, data)
        except Exception as e:
            logger.error(f"Failed to send cancel_all_orders: {str(e)}", exc_info=True)
            raise

    async def replace_sl(self, data):
        try:
            return await replace_sl(self.api_key, self.api_secret, data)
        except Exception as e:
            logger.error(f"Failed to send replace_sl: {str(e)}", exc_info=True)
            raise

    async def cancel_all_tps(self, data):
        try:
            return await cancel_all_tps(self.api_key, self.api_secret, data)
        except Exception as e:
            logger.error(f"Failed to send cancel_all_tps: {str(e)}", exc_info=True)
            raise

    async def bulk_tp(self, data):
        try:
            return await bulk_tp(self.api_key, self.api_secret, data)
        except Exception as e:
            logger.error(f"Failed to send bulk_tp: {str(e)}", exc_info=True)
            raise

    async def partial_close(self, data):
        try:
            return await partial_close(self.api_key, self.api_secret, data)
        except Exception as e:
            logger.error(f"Failed to send partial_close: {str(e)}", exc_info=True)
            raise

    async def send_sl(self, data):
        try:
            return await send_sl(self.api_key, self.api_secret, data)
        except Exception as e:
            logger.error(f"Failed to send send_sl: {str(e)}", exc_info=True)
            raise

    async def cancel_order(self, data):
        try:
            return await cancel_order(self.api_key, self.api_secret, data)
        except Exception as e:
            logger.error(f"Failed to send cancel_order: {str(e)}", exc_info=True)
            raise
