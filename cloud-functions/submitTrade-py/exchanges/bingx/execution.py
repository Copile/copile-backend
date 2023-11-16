import asyncio
import logging
from .api.perpetual import BingXFunctions
from ...utils.firestore import store_trade, store_tp, store_sl, get_trade_info, update_trade_quantity, get_tp_sl_orders
from ...utils.partial import distribute_percentages
from .scripts.order_factory import Order
from .scripts.settings import convert_symbol
from .scripts.cancel import send_cancel
from .scripts.distribution import calculate_tp_amounts
from .scripts.order import get_tps_status

logger = logging.getLogger(__name__)

async def bulkOrder(api_key, api_secret, data):
    try:
        session = BingXFunctions(api_key, api_secret)

        traderId, tradeId, margin, trader_exchange, margin_type = data
        side, leverage, entry, take_profits, stop_losses = data["payload"]

        symbol = convert_symbol(data["payload"]["symbol"])

        order_type = "LIMIT" if entry != "market" else "MARKET"

        precision, margin_mode, set_leverage = await asyncio.gather(
            session.get_precisions(symbol)
        )




    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)

