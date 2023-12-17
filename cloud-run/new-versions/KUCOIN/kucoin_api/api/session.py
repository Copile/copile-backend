import logging
from ..execution.bulk_order import bulk_order
from ..execution.bulk_tp import bulk_tp
from ..execution.cancel_all_orders import cancel_all_orders
from ..execution.cancel_all_tps import cancel_all_tps
from ..execution.cancel_order import cancel_order
from ..execution.replace_sl import replace_sl
from ..execution.send_sl import send_sl
from ..execution.partial_close import partial_close

logger = logging.getLogger(__name__)


class KucoinSession():
    
    def __init__(self, api_key, api_secret):
        """
        Create a new KucoinSession instance.
        
        :param api_key: The API key for the session.
        :param api_secret: The API secret for the session.
        """
        self.api_key = api_key
        self.api_secret = api_secret


    async def bulk_order(self, data):
        try:
            return await bulk_order(self.api_key, self.api_secret, self.api_passphrase, data)
        except Exception as e:
            logger.error(f"Failed to send bulk_order: {str(e)}", exc_info=True)
            raise

    async def cancel_all_orders(self, data):
        try:
            return await cancel_all_orders(self.api_key, self.api_secret, self.api_passphrase, data)
        except Exception as e:
            logger.error(f"Failed to send cancel_all_orders: {str(e)}", exc_info=True)
            raise

    async def replace_sl(self, data):
        try:
            return await replace_sl(self.api_key, self.api_secret, self.api_passphrase, data)
        except Exception as e:
            logger.error(f"Failed to send replace_sl: {str(e)}", exc_info=True)
            raise

    async def cancel_all_tps(self, data):
        try:
            return await cancel_all_tps(self.api_key, self.api_secret, self.api_passphrase, data)
        except Exception as e:
            logger.error(f"Failed to send cancel_all_tps: {str(e)}", exc_info=True)
            raise

    async def bulk_tp(self, data):
        try:
            return await bulk_tp(self.api_key, self.api_secret, self.api_passphrase, data)
        except Exception as e:
            logger.error(f"Failed to send bulk_tp: {str(e)}", exc_info=True)
            raise

    async def partial_close(self, data):
        try:
            return await partial_close(self.api_key, self.api_secret, self.api_passphrase, data)
        except Exception as e:
            logger.error(f"Failed to send partial_close: {str(e)}", exc_info=True)
            raise

    async def send_sl(self, data):
        try:
            return await send_sl(self.api_key, self.api_secret, self.api_passphrase, data)
        except Exception as e:
            logger.error(f"Failed to send send_sl: {str(e)}", exc_info=True)
            raise

    async def cancel_order(self, data):
        try:
            return await cancel_order(self.api_key, self.api_secret, self.api_passphrase, data)
        except Exception as e:
            logger.error(f"Failed to send cancel_order: {str(e)}", exc_info=True)
            raise
