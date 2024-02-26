import logging
from execution.bulk_order import bulk_order
from execution.bulk_tp import bulk_tp
from execution.cancel_all_orders import cancel_all_orders
from execution.cancel_all_tps import cancel_all_tps
from execution.cancel_order import cancel_order
from execution.send_sl import send_sl
from execution.send_tp import send_tp
from execution.partial_close import partial_close

logger = logging.getLogger(__name__)


class MetaSession():
    
    def __init__(self, login_id, password, server):
        """
        Create a new MetaSession instance.
        
        :param login_id: The login id for MetaTrader5.
        :param password: The server password for MetaTrader5.
        :param server: The server name for MetaTrader5
        """
        self.login_id = login_id
        self.password = password
        self.server = server

    async def bulk_order(self, data):
        try:
            return await bulk_order(self.login_id, self.password, self.server, data)
        except Exception as e:
            logger.error(f"Failed to send bulk_order: {str(e)}", exc_info=True)
            raise

    async def cancel_all_orders(self, data):
        try:
            return await cancel_all_orders(self.login_id, self.password, self.server, data)
        except Exception as e:
            logger.error(f"Failed to send cancel_all_orders: {str(e)}", exc_info=True)
            raise

    async def replace_sl(self, data):
        try:
            return await send_sl(self.login_id, self.password, self.server, data)
        except Exception as e:
            logger.error(f"Failed to send replace_sl: {str(e)}", exc_info=True)
            raise

    async def cancel_all_tps(self, data):
        try:
            return await cancel_all_tps(self.login_id, self.password, self.server, data)
        except Exception as e:
            logger.error(f"Failed to send cancel_all_tps: {str(e)}", exc_info=True)
            raise

    async def bulk_tp(self, data):
        try:
            return await bulk_tp(self.login_id, self.password, self.server, data)
        except Exception as e:
            logger.error(f"Failed to send bulk_tp: {str(e)}", exc_info=True)
            raise

    async def partial_close(self, data):
        try:
            return await partial_close(self.login_id, self.password, self.server, data)
        except Exception as e:
            logger.error(f"Failed to send partial_close: {str(e)}", exc_info=True)
            raise

    async def send_sl(self, data):
        try:
            return await send_sl(self.login_id, self.password, self.server, data)
        except Exception as e:
            logger.error(f"Failed to send send_sl: {str(e)}", exc_info=True)
            raise

    async def send_tp(self, data):
        try:
            return await send_sl(self.login_id, self.password, self.server, data)
        except Exception as e:
            logger.error(f"Failed to send send_tp: {str(e)}", exc_info=True)
            raise

    async def cancel_order(self, data):
        try:
            return await cancel_order(self.login_id, self.password, self.server, data)
        except Exception as e:
            logger.error(f"Failed to send cancel_order: {str(e)}", exc_info=True)
            raise
