import asyncio
import logging
from ..api.perpetual import KucoinFunctions
from utils.firestore import store_trade, store_tp, store_sl
from utils.message import message_bulk_order
from utils.notification import notification_bulk_order
from utils.margin import get_margin
from ..scripts.order_factory import Order
from ..scripts.settings import reformat_symbol
from ..scripts.distribution import calculate_tp_amounts

logger = logging.getLogger(__name__)

async def bulk_order(api_key, api_secret, api_passphrase, data):
    try:
        # Creating session for kucoin api
        session = KucoinFunctions(api_key, api_secret, api_passphrase)

        user_id = data['user_id']
        trade_id = data['trade_id']
        plan_id = data['plan_id']
        worker_id = data['worker_id']
        margin = await get_margin(session, user_id, plan_id, worker_id)
        trader_exchange = data['trader_exchange']
        # margin_type = "ISOLATED-MARGIN" if data['margin_type'] == "ISOLATED" else "REGULAR_MARGIN"

        # Reformatting symbol name for kucoin style
        symbol = reformat_symbol(data['payload']['symbol'])

        side = data['payload']['side'].lower()
        leverage = data['payload']['leverage']
        entry = data['payload']['entry']
        take_profits = data['payload']['take_profits']
        stop_losses = data['payload']['stop_losses']

        order_type = "limit" if entry != "market" else "market"

        # Fetching precision for specific symbol
        precision = await session.get_precisions(symbol)

        if entry != "market":
            # Calculate quantity when a specific price is provided
            adjusted_margin = float(margin) * int(leverage)
            quantity_value = round(adjusted_margin / float(entry), precision['quantity_precision'])
            quantity = int(quantity_value / precision['multiplier'])
        else:
            # Calculate quantity when the entry is market
            market_price = await session.get_market(symbol)
            adjusted_margin = float(margin) * int(leverage)
            quantity_value = round(adjusted_margin / market_price, precision['quantity_precision'])
            quantity = int(quantity_value / precision['multiplier'])

        # Order object for initial order
        initial_order = Order(symbol, order_type, side, entry if entry != 'market' else None, quantity, leverage, None,
                              None, None, None)

        # Adding all orders to an array for execution
        prepared_orders = [initial_order]

        # Calculating new take-profits for trade
        new_take_profits = calculate_tp_amounts(take_profits, quantity, precision)

        # Preparing position sides for take-profits and stop-losses
        tp_sl_side = "sell" if side == "buy" else "buy"
        stop_sl = "up" if side == "sell" else "down"
        stop_tp = "up" if side == "buy" else "down"

        # Preparing/Adding take-profits to orders array
        for tp in new_take_profits:
            tp_price = round(float(tp['tp_value']), precision["price_precision"])
            tp_order = Order(symbol, "market", tp_sl_side, tp_price, tp['tp_amount'], leverage, stop_tp, "MP", tp_price,
                             True)
            prepared_orders.append(tp_order)

        # Preparing/Adding stop-losses to orders array
        for sl in stop_losses:
            sl_price = round(float(sl['sl_value']), precision["price_precision"])
            sl['sl_amount'] = round(float(quantity) * float(sl['sl_percentage']), precision["quantity_precision"])
            sl_order = Order(symbol, "market", tp_sl_side, sl_price, sl['sl_amount'], leverage, stop_sl, "MP", sl_price,
                             True)
            prepared_orders.append(sl_order)

        # Executing all orders in the orders array 
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
            tp_order_dict['trade_id'] = trade_id
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
            sl_order_dict['trade_id'] = trade_id
            stop_losses_with_ids.append(sl_order_dict)
            sl_count += 1

        # Preparing trade info for storing in firestore
        trade_info = {
            "trade_id": trade_id,
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

        # Storing trade info in firestore
        await store_trade(user_id, trade_info)

        # Storing take-profits and stop-losses in firestore
        tp_promises = [store_tp(user_id, tp) for tp in new_take_profits_with_ids]
        sl_promises = [store_sl(user_id, sl) for sl in stop_losses_with_ids]

        await asyncio.gather(*tp_promises, *sl_promises)

        await notification_bulk_order(user_id, trade_id, trade_info, new_take_profits, stop_losses)

        return message_bulk_order(trade_id, trade_info, new_take_profits_with_ids, stop_losses_with_ids)

    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)