import asyncio
from ..api.perpetual import BybitFunctions
from utils.firestore import store_trade, store_tp, store_sl
from utils.message import message_bulk_order
from utils.notification import notification_bulk_order
from utils.margin import get_margin
from logs.logger import Logger
from ..scripts.order_factory import Order
from ..scripts.distribution import calculate_tp_amounts

async def bulk_order(api_key, api_secret, data):
    try:
        # Creating session for bybit api
        session = BybitFunctions(api_key, api_secret)

        user_id = data['user_id']
        trade_id = data['trade_id']

        # Creating logger for info/errors
        logger = Logger(user_id, trade_id)

        logger.info(f"Starting bulk order with data: {data}")

        plan_id = data['plan_id']
        worker_id = data['worker_id']
        margin = await get_margin(session, user_id, plan_id, worker_id)
        trader_exchange = data['exchange']
        margin_type = "ISOLATED-MARGIN" if data['margin_type'].upper() == "ISOLATED" else "REGULAR_MARGIN"

        symbol = data['payload']['symbol']
        side = data['payload']['side']
        leverage = data['payload']['leverage']
        entry = data['payload']['entry']
        take_profits = data['payload']['take_profits']
        stop_losses = data['payload']['stop_losses']

        # Order type of initial order
        order_type = "Limit" if entry != "market" else "Market"

        # Fetching precision for specific symbol
        # Setting leverage for trade as well as position mode and margin mode (ISOLATED, CROSSED)
        # Fetching current market price
        precision, set_leverage, position_mode, margin_mode, market_price = await asyncio.gather(
            session.get_precisions(symbol),
            session.set_leverage(symbol, leverage),
            session.switch_position_mode(symbol, 0),
            session.switch_margin_mode(margin_type),
            session.get_market(symbol)
        )

        # Calculating quantity when the entry is either market or specific price
        quantity = round((float(margin) * int(leverage) / float(entry)),
                         precision["quantity_precision"]) if entry != "market" else round(
            (float(margin) * int(leverage) / market_price), precision["quantity_precision"])

        # Order object for initial order
        initial_order = Order(symbol, order_type, side, entry, quantity, None, None, None, False, False)

        # Adding all orders to an array for execution
        prepared_orders = [initial_order]

        # Calculating new take-profits for trade
        new_take_profits = calculate_tp_amounts(take_profits, quantity, precision)
        logger.info(f"New take-profits: {new_take_profits}, for trade based on {take_profits}, {quantity}, {precision}")

        # Preparing position sides for take-profits and stop-losses
        tp_sl_side = "Sell" if side == "Buy" else "Buy"
        tp_trigger_direction = 2 if side == "Sell" else 1
        sl_trigger_direction = 1 if side == "Sell" else 2

        # Preparing/Adding take-profits to orders array
        for tp in new_take_profits:
            tp_price = round(float(tp['tp_value']), precision["price_precision"])
            tp_order = Order(symbol, "Limit", tp_sl_side, tp_price, tp['tp_amount'], tp_trigger_direction, tp_price,
                             "MarkPrice", True, True)
            prepared_orders.append(tp_order)

        # Preparing/Adding stop-losses to orders array
        for sl in stop_losses:
            sl_price = round(float(sl['sl_value']), precision["price_precision"])
            sl['sl_amount'] = round(float(quantity) * float(sl['sl_percentage']), precision["quantity_precision"])
            sl_order = Order(symbol, "Limit", tp_sl_side, sl_price, sl['sl_amount'], sl_trigger_direction, sl_price,
                             "MarkPrice", True, True)
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
            "entry": entry if entry != 'market' else market_price,
            "leverage": leverage,
            "margin": margin,
            "exchange": trader_exchange
        }

        # Storing trade info in firestore
        logger.info(f"Saving trade info to firestore: {trade_info}")
        await store_trade(user_id, trade_info)

        # Storing take-profits and stop-losses in firestore
        tp_promises = [store_tp(user_id, tp) for tp in new_take_profits_with_ids]
        sl_promises = [store_sl(user_id, sl) for sl in stop_losses_with_ids]

        await asyncio.gather(*tp_promises, *sl_promises)
        logger.info(f"Executed bulk_order successfully")

        await notification_bulk_order(user_id, trade_id, trade_info, new_take_profits, stop_losses)

        return message_bulk_order(trade_id, trade_info, new_take_profits_with_ids, stop_losses_with_ids)

    except Exception as e:
        logger.error(e)
        raise e