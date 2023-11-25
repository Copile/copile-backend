import asyncio
import logging
from .api.perpetual import BingXFunctions
from utils.firestore import store_trade, store_tp, store_sl, get_trade_info, update_trade_quantity, get_tp_sl_orders, \
    get_tp_orders, delete_tp_sl_order
from utils.partial import distribute_percentages
from .scripts.order_factory import Order
from .scripts.settings import convert_symbol, get_position_quantity
from .scripts.cancel import send_cancel
from .scripts.distribution import calculate_tp_amounts
from .scripts.order import get_tps_status

logger = logging.getLogger(__name__)


async def bulk_order(api_key, api_secret, data):
    try:

        return

    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)


async def send_sl(api_key, api_secret, data):
    try:

        return

    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)


async def replace_sl(api_key, api_secret, data):
    try:

        return

    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)


async def cancel_order(api_key, api_secret, data):
    try:

        return

    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)


async def cancel_all_orders(api_key, api_secret, data):
    try:

        return

    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)


async def cancel_all_tps(api_key, api_secret, data):
    try:

        return

    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)


async def bulk_tp(api_key, api_secret, data):
    try:

        return

    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)


async def partial_close(api_key, api_secret, data):
    try:

        return

    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)
