import logging
from .execution.bulk_order import bulk_order
from .execution.cancel_all_orders import cancel_all_orders
from .execution.cancel_order import cancel_order
from .execution.send_sl import send_sl
from .execution.send_tp import send_tp
from .execution.partial_close import partial_close
from .execution.utils.firestore import get_tp_orders

logger = logging.getLogger(__name__)


class MetaSession():
    
    def __init__(self, token, meta_id):

        self.token = token
        self.meta_id = meta_id

    async def bulk_order(self, data):
        try:
            return await bulk_order(self.token, self.meta_id, data)
        except Exception as e:
            print(e)
            logger.error(f"Failed to send bulk_order: {str(e)}", exc_info=True)
            raise

    async def cancel_all_orders(self, data):
        try:
            return await cancel_all_orders(self.token, self.meta_id, data)
        except Exception as e:
            print(e)
            logger.error(f"Failed to send cancel_all_orders: {str(e)}", exc_info=True)
            raise

    async def replace_sl(self, data):
        try:
            return await send_sl(self.token, self.meta_id, data)
        except Exception as e:
            print(e)
            logger.error(f"Failed to send replace_sl: {str(e)}", exc_info=True)
            raise

    async def cancel_all_tps(self, data):
        try:
            data['trade_type'] = 'tp'

            return await cancel_order(self.token, self.meta_id, data)
        except Exception as e:
            logger.error(f"Failed to send cancel_all_tps: {str(e)}", exc_info=True)
            raise

    async def bulk_tp(self, data):
        try:

            data['payload'] = data['take_profits'][0]

            return await send_tp(self.token, self.meta_id, data)
        except Exception as e:
            print(e)
            logger.error(f"Failed to send bulk_tp: {str(e)}", exc_info=True)
            raise

    async def partial_close(self, data):
        try:
            return await partial_close(self.token, self.meta_id, data)
        except Exception as e:
            print(e)
            logger.error(f"Failed to send partial_close: {str(e)}", exc_info=True)
            raise

    async def send_sl(self, data):
        try:
            return await send_sl(self.token, self.meta_id, data)
        except Exception as e:
            print(e)
            logger.error(f"Failed to send send_sl: {str(e)}", exc_info=True)
            raise

    async def send_tp(self, data):
        try:
            return await send_tp(self.token, self.meta_id, data)
        except Exception as e:
            print(e)
            logger.error(f"Failed to send send_tp: {str(e)}", exc_info=True)
            raise

    async def cancel_order(self, data):
        try:
            return await cancel_order(self.token, self.meta_id, data)
        except Exception as e:
            print(e)
            logger.error(f"Failed to send cancel_order: {str(e)}", exc_info=True)
            raise
