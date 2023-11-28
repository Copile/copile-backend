import asyncio
import logging
from .api.perpetual import BybitFunctions
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
        session = BybitFunctions(api_key, api_secret)

        traderId = data['traderId']
        tradeId = data['tradeId']
        margin = data['margin']
        trader_exchange = data['trader_exchange']
        margin_type = "ISOLATED-MARGIN" if data['margin_type'] == "ISOLATED" else "REGULAR_MARGIN"

        symbol = data['payload']['symbol']
        side = data['payload']['side']
        leverage = data['payload']['leverage']
        entry = data['payload']['entry']
        take_profits = data['payload']['take_profits']
        stop_losses = data['payload']['stop_losses']

        order_type = "Limit" if entry != "market" else "Market"

        precision, set_leverage, position_mode, margin_mode = await asyncio.gather(
            session.get_precisions(symbol),
            session.set_leverage(symbol, leverage),
            session.switch_position_mode(symbol, 0),
            session.switch_margin_mode(margin_type)
        )

        market_price = float(await session.get_market(symbol))

        quantity = round((float(margin) * int(leverage) / float(entry)),
                         precision["quantity_precision"]) if entry != "market" else round(
            (float(margin) * int(leverage) / market_price), precision["quantity_precision"])

        initial_order = Order(symbol, order_type, side, entry, quantity, None, None, None, False, False)

        prepared_orders = [initial_order]

        new_take_profits = await calculate_tp_amounts(take_profits, quantity, precision)

        tp_sl_side = "Sell" if side == "Buy" else "Buy"
        tp_trigger_direction = 2 if side == "Sell" else 1
        sl_trigger_direction = 1 if side == "Sell" else 2

        for tp in new_take_profits:
            tp_price = round(float(tp['tp_value']), precision["price_precision"])
            tp_order = Order(symbol, "Limit", tp_sl_side, tp_price, tp['tp_amount'], tp_trigger_direction, tp_price,
                             "MarkPrice", True, True)
            prepared_orders.append(tp_order)

        for sl in stop_losses:
            sl_price = round(float(sl['sl_value']), precision["price_precision"])
            sl['sl_amount'] = round(float(quantity) * float(sl['sl_percentage']), precision["quantity_precision"])
            sl_order = Order(symbol, "Limit", tp_sl_side, sl_price, sl['sl_amount'], sl_trigger_direction, sl_price,
                             "MarkPrice", True, True)
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
        session = BybitFunctions(api_key, api_secret)

        traderId = data['traderId']
        tradeId = data['tradeId']
        document_id = data['sl_id']
        payload = data['payload']

        trade_info = await get_trade_info(traderId, tradeId)

        symbol = trade_info["symbol"]
        side = trade_info["side"]
        sl_side = "Buy" if side == "Sell" else "Sell"

        precision, position, tp_sl_mode = await asyncio.gather(
            session.get_precisions(symbol),
            session.get_position(symbol),
            session.set_tp_sl_mode(symbol, "Partial")
        )

        position_quantity = get_position_quantity(position, trade_info)

        price = round(float(payload["sl_value"]), precision["price_precision"])
        trigger_direction = 1 if side == "Sell" else 2

        order = Order(symbol, "Limit", sl_side, price, position_quantity, trigger_direction, price,
                      "MarkPrice", True, True)

        create_order = await session.trade_order(order)

        payload['trade_id'] = tradeId
        payload["sl_amount"] = position_quantity
        payload["order_id"] = create_order["orderId"]
        payload['sl_document_id'] = document_id

        await store_sl(traderId, payload)

        return

    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)


async def replace_sl(api_key, api_secret, data):
    try:
        session = BybitFunctions(api_key, api_secret)

        traderId = data['traderId']
        tradeId = data['tradeId']
        document_id = data['sl_id']
        payload = data['payload']

        trade_info = await get_trade_info(traderId, tradeId)

        symbol = trade_info["symbol"]
        side = trade_info["side"]
        sl_side = "Buy" if side == "Sell" else "Sell"

        await send_cancel(session, symbol, tradeId, document_id, "sl")

        precision, position, tp_sl_mode = await asyncio.gather(
            session.get_precisions(symbol),
            session.get_position(symbol),
            session.set_tp_sl_mode(symbol, "Partial")
        )

        position_quantity = get_position_quantity(position, trade_info)

        price = round(float(payload["sl_value"]), precision["price_precision"])
        trigger_direction = 1 if side == "Sell" else 2

        order = Order(symbol, "Limit", sl_side, price, position_quantity, trigger_direction, price,
                      "MarkPrice", True, True)

        create_order = await session.trade_order(order)

        payload['trade_id'] = tradeId
        payload["sl_amount"] = position_quantity
        payload["order_id"] = create_order["orderId"]
        payload['sl_document_id'] = document_id

        await store_sl(traderId, payload)

        return

    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)


async def cancel_order(api_key, api_secret, data):
    try:
        session = BybitFunctions(api_key, api_secret)

        traderId = data['traderId']
        tradeId = data['tradeId']
        document_id = data['sl_id']
        trade_type = data['trade_type']

        trade_info = await get_trade_info(traderId, tradeId)

        symbol = trade_info["symbol"]

        await send_cancel(session, symbol, traderId, tradeId, document_id, trade_type)

        return

    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)


async def cancel_all_orders(api_key, api_secret, data):
    try:
        session = BybitFunctions(api_key, api_secret)

        traderId = data['traderId']
        tradeId = data['tradeId']

        trade_info = await get_trade_info(traderId, tradeId)

        symbol = trade_info["symbol"]

        position = await session.get_position(symbol)

        quantity = float(position['size'])

        if quantity != 0:
            side = trade_info['side']

            order = Order(symbol, "Market", 'Buy' if side == 'Sell' else 'Sell', None, quantity, None, None, None, True,
                          False)
            await session.trade_order(order)
        else:
            await session.cancel_order(symbol, trade_info['orderID'], None)

        await session.cancel_all_orders(symbol)

        return

    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)


async def cancel_all_tps(api_key, api_secret, data):
    try:
        session = BybitFunctions(api_key, api_secret)

        traderId = data['traderId']
        tradeId = data['tradeId']

        trade_info, tp_orders = await asyncio.gather(
            get_trade_info(traderId, tradeId),
            get_tp_orders(traderId, tradeId)
        )

        await asyncio.gather(
            *[session.cancel_order(trade_info["symbol"], order['orderID'], None) for order in tp_orders])
        await asyncio.gather(
            *[delete_tp_sl_order(traderId, tradeId, order['document_id'], "tp") for order in tp_orders])
        return

    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)


async def bulk_tp(api_key, api_secret, data):
    try:
        session = BybitFunctions(api_key, api_secret)

        traderId = data['traderId']
        tradeId = data['tradeId']
        take_profits = data['take_profits']

        trade_info = await get_trade_info(traderId, tradeId)

        symbol = trade_info["symbol"]
        side = trade_info['side']
        tp_side = "Buy" if side == "Sell" else "Sell"

        position, precision = await asyncio.gather(
            session.get_position(symbol),
            session.get_precisions(symbol)
        )

        position_quantity = get_position_quantity(position, trade_info)

        new_take_profits = await calculate_tp_amounts(take_profits, position_quantity, precision)

        prepared_orders = []

        trigger_direction = 2 if side == "Sell" else 1

        for tp in new_take_profits:
            tp_price = round(float(tp['tp_value']), precision["price_precision"])
            tp_order = Order(symbol, "Limit", tp_side, tp_price, tp['tp_amount'], trigger_direction, tp_price,
                             "MarkPrice", True, True)
            prepared_orders.append(tp_order)

        order_ids = await asyncio.gather(*(session.trade_order(order) for order in prepared_orders))

        new_take_profits_with_ids = []

        tp_count = 0
        # Assign orderIds to take profits
        for i, tp_order in enumerate(prepared_orders[0:len(new_take_profits)], start=0):
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

        # Store take profits in firestore
        tp_promises = [store_tp(traderId, tp) for tp in new_take_profits_with_ids]

        await asyncio.gather(*tp_promises)

        return

    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)


async def partial_close(api_key, api_secret, data):
    try:
        session = BybitFunctions(api_key, api_secret)

        traderId = data['traderId']
        tradeId = data['tradeId']
        percentage = data['percentage']

        trade_info, tp_sl_orders = await asyncio.gather(
            get_trade_info(traderId, tradeId),
            get_tp_sl_orders(traderId, tradeId)
        )

        symbol = trade_info["symbol"]
        side = trade_info["side"]
        tp_sl_side = "Sell" if side == "Buy" else "buy"
        tp_trigger_direction = 2 if side == "Sell" else 1
        sl_trigger_direction = 1 if side == "Sell" else 2

        # Split tp_sl_orders into tp/sl orders
        tp_orders = [order for order in tp_sl_orders if order['trade_type'] == 'tp']
        sl_orders = [order for order in tp_sl_orders if order['trade_type'] == 'sl']

        # Fetch the current position and precisions
        position, precision = await asyncio.gather(
            session.get_position(symbol),
            session.get_precisions(symbol)
        )

        executed = True if float(position['size']) != 0 else False

        position_quantity = get_position_quantity(position, trade_info)

        quantity_to_sell = round(position_quantity * float(percentage), precision["quantity_precision"])
        new_quantity = round(position_quantity - quantity_to_sell, precision["quantity_precision"])

        tps_data = await get_tps_status(session, tp_orders, trade_info)

        take_profits = distribute_percentages(tps_data)

        new_take_profits = await calculate_tp_amounts(take_profits, new_quantity, precision)

        await session.cancel_all_orders(symbol)

        if executed:
            sell_order = Order(symbol, "Market", 'Buy' if side == 'Sell' else 'Sell', None, quantity_to_sell, None,
                               None, None, True,
                               False)
            await session.trade_order(sell_order)
            await update_trade_quantity(traderId, tradeId, new_quantity)
        else:
            await session.cancel_order(symbol, trade_info["orderID"], None)

            order = Order(symbol, "Limit", side, trade_info['entry'], new_quantity, None, None, None, False, False)

            create_order = await session.trade_order(order)

            trade_info = {
                "trade_id": tradeId,
                "order_id": create_order["orderId"],
                "symbol": symbol,
                "type": "Limit",
                "side": side,
                "quantity": new_quantity,
                "entry": trade_info["entry"],
                "leverage": trade_info["leverage"],
                "margin": round(float(trade_info["margin"] * float(percentage)), 2),
                "exchange": trade_info["exchange"]
            }

            await store_trade(traderId, trade_info)

            prepared_orders = []
            new_take_profits_with_ids = []
            stop_losses_with_ids = []

            for tp in new_take_profits:
                tp_price = round(float(tp['tp_value']), precision["price_precision"])
                tp_order = Order(symbol, "Limit", tp_sl_side, tp_price, tp['tp_amount'], tp_trigger_direction, tp_price,
                                 "MarkPrice", True, True)
                prepared_orders.append(tp_order)

            for sl in sl_orders:
                sl_price = round(float(sl['sl_value']), precision["price_precision"])
                sl['sl_amount'] = round(float(new_quantity) * float(sl['sl_percentage']),
                                        precision["quantity_precision"])
                sl_order = Order(symbol, "Limit", tp_sl_side, sl_price, sl['sl_amount'], sl_trigger_direction, sl_price,
                                 "MarkPrice", True, True)
                prepared_orders.append(sl_order)

            order_ids = await asyncio.gather(*(session.trade_order(order) for order in prepared_orders))

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
                sl_order_dict['order_id'] = order_ids[i]['order']['orderId']
                sl_order_dict['sl_document_id'] = sl_orders[sl_count]['sl_id']
                sl_order_dict['sl_number'] = sl_orders[sl_count]['sl_number']
                sl_order_dict['sl_percentage'] = sl_orders[sl_count]['sl_percentage']
                sl_order_dict['sl_value'] = sl_orders[sl_count]['sl_value']
                sl_order_dict['sl_amount'] = sl_orders[sl_count]['sl_amount']
                sl_order_dict['trade_id'] = tradeId
                stop_losses_with_ids.append(sl_order_dict)
                sl_count += 1

            tp_promises = [store_tp(traderId, tp) for tp in new_take_profits_with_ids]
            sl_promises = [store_sl(traderId, sl) for sl in stop_losses_with_ids]

            await asyncio.gather(*tp_promises, *sl_promises)

        return

    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)
