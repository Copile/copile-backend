import asyncio
import logging
from .api.perpetual import BinanceFunctions
from utils.firestore import store_trade, store_tp, store_sl, get_trade_info, update_trade_quantity, get_tp_sl_orders, \
    get_tp_orders, delete_tp_sl_order
from utils.partial import distribute_percentages
from .scripts.order_factory import Order
from .scripts.cancel import send_cancel
from .scripts.settings import get_position_quantity
from .scripts.distribution import calculate_tp_amounts
from .scripts.order import get_tps_status

logger = logging.getLogger(__name__)


async def bulk_order(api_key, api_secret, data):
    try:
        session = BinanceFunctions(api_key, api_secret)

        traderId = data['traderId']
        tradeId = data['tradeId']
        margin = data['margin']
        trader_exchange = data['trader_exchange']
        margin_type = data['margin_type']

        symbol = data['payload']['symbol']
        side = data['payload']['side'].capitalize()
        leverage = data['payload']['leverage']
        entry = data['payload']['entry']
        take_profits = data['payload']['take_profits']
        stop_losses = data['payload']['stop_losses']

        order_type = "LIMIT" if entry != "market" else "MARKET"

        precision, set_leverage, margin_mode = await asyncio.gather(
            session.get_precisions(symbol),
            session.set_leverage(symbol, leverage),
            session.switch_margin_mode(symbol, margin_type)
        )

        market_price = float(await session.get_market(symbol))

        quantity = round((float(margin) * int(leverage) / float(entry)),
                         precision["quantity_precision"]) if entry != "market" else round(
            (float(margin) * int(leverage) / market_price), precision["quantity_precision"])

        initial_order = Order(symbol, order_type, side, entry, quantity, None, False)

        prepared_orders = [initial_order]

        new_take_profits = await calculate_tp_amounts(take_profits, quantity, precision)

        tp_sl_side = "SELL" if side == "BUY" else "BUY"

        for tp in new_take_profits:
            tp_price = round(float(tp['tp_value']), precision["price_precision"])
            tp_order = Order(symbol, "TAKE_PROFIT_MARKET", tp_sl_side, None, tp['tp_amount'], tp_price, True)
            prepared_orders.append(tp_order)

        for sl in stop_losses:
            sl_price = round(float(sl['sl_value']), precision["price_precision"])
            sl['sl_amount'] = round(float(quantity) * float(sl['sl_percentage']), precision["quantity_precision"])
            sl_order = Order(symbol, "STOP_MARKET", tp_sl_side, None, sl['sl_amount'], sl_price, True)
            prepared_orders.append(sl_order)

        order_ids = await asyncio.gather(*(session.trade_order(order) for order in prepared_orders))

        new_take_profits_with_ids = []
        stop_losses_with_ids = []

        # Assign orderIds to take profits and stop losses
        tp_count = 0
        for i, tp_order in enumerate(prepared_orders[1:len(new_take_profits) + 1], start=1):
            tp_order_dict = vars(tp_order)
            tp_order_dict['order_id'] = order_ids[i]['orderId']
            tp_order_dict['tp_document_id'] = new_take_profits[tp_count]['tp_id']
            tp_order_dict['tp_number'] = new_take_profits[tp_count]['tp_number']
            tp_order_dict['tp_percentage'] = new_take_profits[tp_count]['tp_percentage']
            tp_order_dict['tp_value'] = new_take_profits[tp_count]['tp_value']
            tp_order_dict['tp_amount'] = new_take_profits[tp_count]['tp_amount']
            tp_order_dict['trade_id'] = tradeId
            new_take_profits_with_ids.append(tp_order_dict)
            tp_count += 1

        sl_count = 0
        for i, sl_order in enumerate(prepared_orders[len(new_take_profits) + 1:], start=len(new_take_profits) + 1):
            sl_order_dict = vars(sl_order)
            sl_order_dict['order_id'] = order_ids[i]['orderId']
            sl_order_dict['sl_document_id'] = stop_losses[sl_count]['sl_id']
            sl_order_dict['sl_number'] = stop_losses[sl_count]['sl_number']
            sl_order_dict['sl_percentage'] = stop_losses[sl_count]['sl_percentage']
            sl_order_dict['sl_value'] = stop_losses[sl_count]['sl_value']
            sl_order_dict['sl_amount'] = stop_losses[sl_count]['sl_amount']
            sl_order_dict['trade_id'] = tradeId
            stop_losses_with_ids.append(sl_order_dict)
            sl_count += 1

        trade_info = {
            "trade_id": tradeId,
            "order_id": order_ids[0]["orderId"],
            "symbol": symbol,
            "type": order_type,
            "side": side,
            "quantity": quantity,
            "entry": entry,
            "leverage": leverage,
            "margin": margin,
            "exchange": trader_exchange
        }

        await store_trade(traderId, trade_info)

        tp_promises = [store_tp(traderId, tp) for tp in new_take_profits_with_ids]
        sl_promises = [store_sl(traderId, sl) for sl in stop_losses_with_ids]

        await asyncio.gather(*tp_promises, *sl_promises)

        return

    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)


async def send_sl(api_key, api_secret, data):
    try:
        session = BinanceFunctions(api_key, api_secret)

        traderId = data['traderId']
        tradeId = data['tradeId']
        document_id = data['sl_id']
        payload = data['payload']

        trade_info = await get_trade_info(traderId, tradeId)

        symbol = trade_info["symbol"]
        side = trade_info["side"]
        sl_side = "SELL" if side == "BUY" else "BUY"

        precision, position = await asyncio.gather(
            session.get_precisions(symbol),
            session.get_position(symbol)
        )


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
