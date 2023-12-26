import asyncio
from .api.perpetual import BybitFunctions
from utils.firestore import store_trade, store_tp, store_sl, get_trade_info, update_trade_quantity, get_tp_sl_orders, \
    get_tp_orders, delete_tp_sl_order
from utils.message import message_replace_sl, message_send_sl, message_bulk_tp, message_bulk_order, \
    message_cancel_order, message_cancel_all_tps, message_cancel_orders, message_partial_close
from utils.partial import distribute_percentages
from logs.logger import Logger
from .scripts.order_factory import Order
from .scripts.cancel import send_cancel
from .scripts.settings import get_position_quantity
from .scripts.distribution import calculate_tp_amounts
from .scripts.order import get_tps_status

async def bulk_order(api_key, api_secret, data):
    try:
        # Creating session for bybit api
        session = BybitFunctions(api_key, api_secret)

        traderId = data['traderId']
        tradeId = data['tradeId']

        # Creating logger for info/errors
        logger = Logger(traderId, tradeId)

        margin = data['margin']
        trader_exchange = data['trader_exchange']
        margin_type = "ISOLATED-MARGIN" if data['margin_type'] == "ISOLATED" else "REGULAR_MARGIN"

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

        # Preparing trade info for storing in firestore
        trade_info = {
            "trade_id": tradeId,
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
        await store_trade(traderId, trade_info)

        # Storing take-profits and stop-losses in firestore
        tp_promises = [store_tp(traderId, tp) for tp in new_take_profits_with_ids]
        sl_promises = [store_sl(traderId, sl) for sl in stop_losses_with_ids]

        await asyncio.gather(*tp_promises, *sl_promises)

        return message_bulk_order(tradeId, trade_info, new_take_profits_with_ids, stop_losses_with_ids)

    except Exception as e:
        logger.error(e)
        raise e

async def send_sl(api_key, api_secret, data):
    try:
        # Creating session for bybit api
        session = BybitFunctions(api_key, api_secret)

        traderId = data['traderId']
        tradeId = data['tradeId']

        # Creating logger for info/errors
        logger = Logger(traderId, tradeId)

        document_id = data['sl_id']
        payload = data['payload']

        # Fetching the trade info from firestore
        trade_info = await get_trade_info(traderId, tradeId)
        symbol = trade_info["symbol"]
        side = trade_info["side"]

        # Preparing position side stop-loss
        sl_side = "Buy" if side == "Sell" else "Sell"
        trigger_direction = 1 if side == "Sell" else 2

        # Fetching current position and precision of symbol
        # Changing the tp/sl mode to partial for sending stop-losses
        precision, position, tp_sl_mode = await asyncio.gather(
            session.get_precisions(symbol),
            session.get_position(symbol),
            session.set_tp_sl_mode(symbol, "Partial")
        )

        # Getting current position quantity to use for stop-loss order
        position_quantity = get_position_quantity(position, trade_info)

        price = round(float(payload["sl_value"]), precision["price_precision"])

        # Creating stop-loss order object
        order = Order(symbol, "Limit", sl_side, price, position_quantity, trigger_direction, price,
                      "MarkPrice", True, True)

        # Executing new stop-loss order
        create_order = await session.trade_order(order)

        # Preparing payload for storing in firestore
        payload['trade_id'] = tradeId
        payload["sl_amount"] = position_quantity
        payload["order_id"] = create_order["orderId"]
        payload['sl_document_id'] = document_id

        # Storing stop-loss in firestore
        await store_sl(traderId, payload)

        return message_send_sl(tradeId, payload)

    except Exception as e:
        logger.error(e)
        raise e

async def replace_sl(api_key, api_secret, data):
    try:
        # Creating session for bybit api
        session = BybitFunctions(api_key, api_secret)

        traderId = data['traderId']
        tradeId = data['tradeId']

        # Creating logger for info/errors
        logger = Logger(traderId, tradeId)

        document_id = data['document_id']
        payload = data['payload']

        # Fetching the trade info from firestore
        trade_info = await get_trade_info(traderId, tradeId)
        symbol = trade_info["symbol"]
        side = trade_info["side"]

        # Preparing position side stop-loss
        sl_side = "Buy" if side == "Sell" else "Sell"
        trigger_direction = 1 if side == "Sell" else 2

        # Fetching current position and precision of symbol
        # Changing the tp/sl mode to partial for sending stop-losses
        # Cancelling old stop-loss
        precision, position, tp_sl_mode, cancel = await asyncio.gather(
            session.get_precisions(symbol),
            session.get_position(symbol),
            session.set_tp_sl_mode(symbol, "Partial"),
            send_cancel(session, symbol, traderId, tradeId, document_id, "sl")
        )

        # Getting current position quantity to use for stop-loss order
        position_quantity = get_position_quantity(position, trade_info)

        price = round(float(payload["sl_value"]), precision["price_precision"])

        # Creating stop-loss order object
        order = Order(symbol, "Limit", sl_side, price, position_quantity, trigger_direction, price,
                      "MarkPrice", True, True)

        # Executing new stop-loss order
        create_order = await session.trade_order(order)

        # Preparing payload for storing in firestore
        payload['trade_id'] = tradeId
        payload["sl_amount"] = position_quantity
        payload["order_id"] = create_order["orderId"]
        payload['sl_document_id'] = document_id

        # Storing stop-loss in firestore
        await store_sl(traderId, payload)

        return message_replace_sl(tradeId, document_id, payload)

    except Exception as e:
        logger.error(e)
        raise e

async def cancel_order(api_key, api_secret, data):
    try:
        # Creating session for bybit api
        session = BybitFunctions(api_key, api_secret)

        traderId = data['traderId']
        tradeId = data['tradeId']

        # Creating logger for info/errors
        logger = Logger(traderId, tradeId)

        document_id = data['document_id']
        trade_type = data['trade_type']

        # Fetching the trade info from firestore
        trade_info = await get_trade_info(traderId, tradeId)
        symbol = trade_info["symbol"]

        # Cancelling specific order based on trade_type (tp/sl)
        await send_cancel(session, symbol, traderId, tradeId, document_id, trade_type)

        return message_cancel_order(tradeId, document_id, trade_type)

    except Exception as e:
        logger.error(e)
        raise e

async def cancel_all_orders(api_key, api_secret, data):
    try:
        # Creating session for bybit api
        session = BybitFunctions(api_key, api_secret)

        traderId = data['traderId']
        tradeId = data['tradeId']

        # Creating logger for info/errors
        logger = Logger(traderId, tradeId)

        # Fetching the trade info from firestore
        trade_info = await get_trade_info(traderId, tradeId)
        symbol = trade_info["symbol"]

        # Getting current position info
        position = await session.get_position(symbol)

        # Getting current position quantity to use for cancel order
        quantity = float(position['size'])

        if quantity != 0:
            side = trade_info['side']

            # Creating order object for selling whole order
            order = Order(symbol, "Market", 'Buy' if side == 'Sell' else 'Sell', None, quantity, None, None, None, True,
                          False)

            # Executing sell order to stop trade
            await session.trade_order(order)
        else:
            # Cancelling existing limit order
            await session.cancel_order(symbol, trade_info['orderID'], None)

        # Cancelling all active take-profits and stop-losses
        await session.cancel_all_orders(symbol)

        return message_cancel_orders(tradeId)

    except Exception as e:
        logger.error(e)
        raise e

async def cancel_all_tps(api_key, api_secret, data):
    try:
        # Creating session for bybit api
        session = BybitFunctions(api_key, api_secret)

        traderId = data['traderId']
        tradeId = data['tradeId']

        # Creating logger for info/errors
        logger = Logger(traderId, tradeId)

        # Fetching the trade info and current take-profit orders from firestore
        trade_info, tp_orders = await asyncio.gather(
            get_trade_info(traderId, tradeId),
            get_tp_orders(traderId, tradeId)
        )

        # Cancelling all current take-profits order and deleting them from firestore
        await asyncio.gather(
            *[session.cancel_order(trade_info["symbol"], order['orderID'], None) for order in tp_orders])
        await asyncio.gather(
            *[delete_tp_sl_order(traderId, tradeId, order['document_id'], "tp") for order in tp_orders])
        return message_cancel_all_tps(tradeId, tp_orders)

    except Exception as e:
        logger.error(e)
        raise e

async def bulk_tp(api_key, api_secret, data):
    try:
        # Creating session for bybit api
        session = BybitFunctions(api_key, api_secret)

        traderId = data['traderId']
        tradeId = data['tradeId']

        # Creating logger for info/errors
        logger = Logger(traderId, tradeId)

        take_profits = data['take_profits']

        # Fetching the trade info from firestore
        trade_info = await get_trade_info(traderId, tradeId)
        symbol = trade_info["symbol"]
        side = trade_info['side']

        # Preparing position sides for take-profits
        tp_side = "Buy" if trade_info['side'] == "Sell" else "Sell"
        trigger_direction = 2 if side == "Sell" else 1

        # Fetch the current position and precisions
        position, precision = await asyncio.gather(
            session.get_position(symbol),
            session.get_precisions(symbol)
        )

        # Getting current position quantity to use for take-profit orders
        position_quantity = get_position_quantity(position, trade_info)

        # Calculating new take-profits for replacing current ones
        new_take_profits = calculate_tp_amounts(take_profits, position_quantity, precision)

        prepared_orders = []

        # Preparing/Adding take-profits to orders array
        for tp in new_take_profits:
            tp_price = round(float(tp['tp_value']), precision["price_precision"])
            tp_order = Order(symbol, "Limit", tp_side, tp_price, tp['tp_amount'], trigger_direction, tp_price,
                             "MarkPrice", True, True)
            prepared_orders.append(tp_order)

        # Executing all orders in the orders array
        order_ids = await asyncio.gather(*(session.trade_order(order) for order in prepared_orders))

        # Arrays to store orders for order id filtering
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

        return message_bulk_tp(tradeId, new_take_profits_with_ids)

    except Exception as e:
        logger.error(e)
        raise e

async def partial_close(api_key, api_secret, data):
    try:
        # Creating session for bybit api
        session = BybitFunctions(api_key, api_secret)

        traderId = data['traderId']
        tradeId = data['tradeId']

        # Creating logger for info/errors
        logger = Logger(traderId, tradeId)

        percentage = data['percentage']

        # Fetching the trade info and current take-profits/stop-losses from firestore
        trade_info, tp_sl_orders = await asyncio.gather(
            get_trade_info(traderId, tradeId),
            get_tp_sl_orders(traderId, tradeId)
        )
        symbol = trade_info["symbol"]
        side = trade_info["side"]

        # Preparing position sides for take-profits and stop-losses
        tp_sl_side = "Sell" if side == "Buy" else "Buy"
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

        # Variable for determining if trade executed or still limit
        executed = True if float(position['size']) != 0 else False

        # Fetching the current position quantity for further use
        position_quantity = get_position_quantity(position, trade_info)

        quantity_to_sell = round(position_quantity * float(percentage), precision["quantity_precision"])
        new_quantity = round(position_quantity - quantity_to_sell, precision["quantity_precision"])

        # Fetching the statuses of all take-profits for filtering active/inactive
        tps_data = await get_tps_status(session, tp_orders, trade_info)

        # Using algo to redistribute take-profits to match new quantity
        take_profits = distribute_percentages(tps_data)

        # Calculating new take-profits for replacing current ones
        new_take_profits = calculate_tp_amounts(take_profits, new_quantity, precision)

        # Cancelling all active tps/sls as well as old limit orders
        await session.cancel_all_orders(symbol)

        if executed:
            # Creating sell order object for selling partial quantity
            sell_order = Order(symbol, "Market", tp_sl_side, None, quantity_to_sell, None,
                               None, None, True,
                               False)

            # Executing sell order to decrease quantity
            await session.trade_order(sell_order)

            # Updating new quantity in firestore
            await update_trade_quantity(traderId, tradeId, new_quantity)
        else:
            # Creating new limit order object to replace old order
            order = Order(symbol, "Limit", side, trade_info['entry'], new_quantity, None, None, None, False, False)

            # Executing new limit order
            create_order = await session.trade_order(order)

            # Preparing trade info for storing in firestore
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

            # Storing trade info in firestore
            await store_trade(traderId, trade_info)

        # Arrays to store orders for execution or order id filtering
        prepared_orders = []
        new_take_profits_with_ids = []
        stop_losses_with_ids = []

        # Preparing/Adding take-profits to orders array
        for tp in new_take_profits:
            tp_price = round(float(tp['tp_value']), precision["price_precision"])
            tp_order = Order(symbol, "Limit", tp_sl_side, tp_price, tp['tp_amount'], tp_trigger_direction, tp_price,
                             "MarkPrice", True, True)
            prepared_orders.append(tp_order)

        # Preparing/Adding stop-losses to orders array
        for sl in sl_orders:
            sl_price = round(float(sl['sl_value']), precision["price_precision"])
            sl['sl_amount'] = round(float(new_quantity) * float(sl['sl_percentage']),
                                    precision["quantity_precision"])
            sl_order = Order(symbol, "Limit", tp_sl_side, sl_price, sl['sl_amount'], sl_trigger_direction, sl_price,
                             "MarkPrice", True, True)
            prepared_orders.append(sl_order)

        # Executing all orders in the orders array
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
            sl_order_dict['order_id'] = order_ids[i]['orderId']
            sl_order_dict['sl_document_id'] = sl_orders[sl_count]['sl_id']
            sl_order_dict['sl_number'] = sl_orders[sl_count]['sl_number']
            sl_order_dict['sl_percentage'] = sl_orders[sl_count]['sl_percentage']
            sl_order_dict['sl_value'] = sl_orders[sl_count]['sl_value']
            sl_order_dict['sl_amount'] = sl_orders[sl_count]['sl_amount']
            sl_order_dict['trade_id'] = tradeId
            stop_losses_with_ids.append(sl_order_dict)
            sl_count += 1

        # Storing take-profits and stop-losses in firestore
        tp_promises = [store_tp(traderId, tp) for tp in new_take_profits_with_ids]
        sl_promises = [store_sl(traderId, sl) for sl in stop_losses_with_ids]

        await asyncio.gather(*tp_promises, *sl_promises)

        return message_partial_close(tradeId, new_quantity, new_take_profits_with_ids, stop_losses_with_ids)

    except Exception as e:
        logger.error(e)
        raise e