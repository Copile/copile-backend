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
            session.get_precisions(symbol),
            session.switch_margin_mode(symbol, margin_type),
            session.set_leverage(symbol, side, leverage)
        )

        quantity = round((float(margin) * int(leverage) / float(entry)), precision["quantity_precision"]) if entry != "market" else round((float(margin) * int(leverage) / float(await session.get_market(symbol))), precision["quantity_precision"])


        prepared_orders = []

        order_side = "LONG" if side == "Buy" else "SHORT"
        initial_order = Order(symbol, order_type, side.upper(), None if entry == "market" else entry, quantity, order_side, None, None)
        prepared_orders.append(initial_order)

        new_take_profits = await calculate_tp_amounts(take_profits, quantity, precision)

        tp_sl_position_side = "LONG" if side == "Buy" else "SHORT"

        for tp in new_take_profits:
            tp_order_id = str(uuid.uuid4())
            tp.trade_id = tradeId
            tp_price = round(float(tp.tp_value), precision["price_precision"])
            tp_order = Order(symbol, "TRIGGER_MARKET", "SELL" if side == "Buy" else "BUY", None, tp.tp_amount, tp_sl_position_side, tp_price, tp_order_id)
            prepared_orders.append(tp_order)

        for sl in stop_losses:
            sl_order_id = str(uuid.uuid4())
            sl.trade_id = tradeId
            sl_price = round(float(sl.sl_value), precision["price_precision"])
            sl.sl_amount = round(float(quantity) * float(sl.sl_percentage), precision["quantity_precision"])
            sl_order = Order(symbol, "TRIGGER_MARKET", "SELL" if side == "Buy" else "BUY", None, sl.sl_amount, tp_sl_position_side, sl_price, sl_order_id)
            prepared_orders.append(sl_order)

        await asyncio.gather(*(session.trade_order(order) for order in prepared_orders))


    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)

