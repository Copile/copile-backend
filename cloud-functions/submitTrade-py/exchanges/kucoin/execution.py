import asyncio
import logging
from .api.perpetual import KucoinFunctions
from utils.firestore import store_trade, store_tp, store_sl, get_trade_info, update_trade_quantity, get_tp_sl_orders, \
    get_tp_orders, delete_tp_sl_order
from utils.partial import distribute_percentages
from .scripts.order_factory import Order
from .scripts.cancel import send_cancel
from .scripts.settings import get_position_quantity, reformat_symbol
from .scripts.distribution import calculate_tp_amounts
from .scripts.order import get_tps_status

logger = logging.getLogger(__name__)


async def bulk_order(api_key, api_secret, data):
    try:
        session = KucoinFunctions(api_key, api_secret)

        traderId = data['traderId']
        tradeId = data['tradeId']
        margin = data['margin']
        trader_exchange = data['trader_exchange']
        margin_type = "ISOLATED-MARGIN" if data['margin_type'] == "ISOLATED" else "REGULAR_MARGIN"

        symbol = reformat_symbol(data['payload']['symbol'])
        side = data['payload']['side'].lower()
        leverage = data['payload']['leverage']
        entry = data['payload']['entry']
        take_profits = data['payload']['take_profits']
        stop_losses = data['payload']['stop_losses']

        order_type = "limit" if entry != "market" else "market"

        precision = session.get_precisions(symbol)

        market_price = float(await session.get_market(symbol))

        quantity = round((float(margin) * int(leverage) / float(entry)),
                         precision["quantity_precision"]) if entry != "market" else round(
            (float(margin) * int(leverage) / market_price), precision["quantity_precision"])

        initial_order = Order(symbol, order_type, side, entry, quantity, leverage, None, None, None, False)

        prepared_orders = [initial_order]

        new_take_profits = await calculate_tp_amounts(take_profits, quantity, precision)

        tp_sl_side = "sell" if side == "buy" else "buy"

        for tp in new_take_profits:
            tp_price = round(float(tp['tp_value']), precision["price_precision"])
            tp_order = Order()
            prepared_orders.append(tp_order)

        for sl in stop_losses:
            sl_price = round(float(sl['sl_value']), precision["price_precision"])
            sl['sl_amount'] = round(float(quantity) * float(sl['sl_percentage']), precision["quantity_precision"])
            sl_order = Order(symbol, "Limit", tp_sl_side, sl_price, sl['sl_amount'], sl_trigger_direction, sl_price,
                             "MarkPrice", True, True)
            prepared_orders.append(sl_order)

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
