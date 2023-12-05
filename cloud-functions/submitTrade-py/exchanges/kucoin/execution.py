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


async def bulk_order(api_key, api_secret, api_passphrase, data):
    try:
        session = KucoinFunctions(api_key, api_secret, api_passphrase)

        traderId = data['traderId']
        tradeId = data['tradeId']
        margin = data['margin']
        trader_exchange = data['trader_exchange']
        # margin_type = "ISOLATED-MARGIN" if data['margin_type'] == "ISOLATED" else "REGULAR_MARGIN"

        symbol = reformat_symbol(data['payload']['symbol'])
        side = data['payload']['side'].lower()
        leverage = data['payload']['leverage']
        entry = data['payload']['entry']
        take_profits = data['payload']['take_profits']
        stop_losses = data['payload']['stop_losses']

        order_type = "limit" if entry != "market" else "market"

        precision = await session.get_precisions(symbol)

        if entry != "market":
            # Calculate quantity when a specific price is provided
            adjusted_margin = float(margin) * int(leverage)
            quantity_value = round(adjusted_margin / float(entry), precision['quantity_precision'])
            quantity = int(quantity_value / precision['multiplier'])
        else:
            # Calculate quantity when the price is 'market'
            market_price = await session.get_market(symbol)
            adjusted_margin = float(margin) * int(leverage)
            quantity_value = round(adjusted_margin / market_price, precision['quantity_precision'])
            quantity = int(quantity_value / precision['multiplier'])

        initial_order = Order(symbol, order_type, side, entry if entry != 'market' else None, quantity, leverage, None,
                              None, None, None)

        prepared_orders = [initial_order]

        new_take_profits = await calculate_tp_amounts(take_profits, quantity, precision)

        tp_sl_side = "sell" if side == "buy" else "buy"
        stop = "up" if side == "sell" else "down"

        for tp in new_take_profits:
            tp_price = round(float(tp['tp_value']), precision["price_precision"])
            tp_order = Order(symbol, "market", tp_sl_side, tp_price, tp['tp_amount'], leverage, stop, "MP", tp_price,
                             True)
            prepared_orders.append(tp_order)

        for sl in stop_losses:
            sl_price = round(float(sl['sl_value']), precision["price_precision"])
            sl['sl_amount'] = round(float(quantity) * float(sl['sl_percentage']), precision["quantity_precision"])
            sl_order = Order(symbol, "market", tp_sl_side, sl_price, sl['sl_amount'], leverage, stop, "MP", sl_price,
                             True)
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


async def send_sl(api_key, api_secret, api_passphrase, data):
    try:
        session = KucoinFunctions(api_key, api_secret, api_passphrase)

        traderId = data['traderId']
        tradeId = data['tradeId']
        document_id = data['sl_id']
        payload = data['payload']

        trade_info = await get_trade_info(traderId, tradeId)

        symbol = trade_info["symbol"]
        side = trade_info["side"]
        leverage = trade_info["leverage"]
        sl_side = "sell" if side == "buy" else "buy"
        stop = "up" if side == "sell" else "down"

        precision, position = await asyncio.gather(
            session.get_precisions(symbol),
            session.get_position(symbol)
        )

        position_quantity = get_position_quantity(position, trade_info)

        price = round(float(payload["sl_value"]), precision["price_precision"])

        order = Order(symbol, "market", sl_side, price, position_quantity, leverage, stop, "MP", price,
                      True)

        create_order = await session.trade_order(order)

        payload['trade_id'] = tradeId
        payload["sl_amount"] = position_quantity
        payload["order_id"] = create_order["orderId"]
        payload['sl_document_id'] = document_id

        await store_sl(traderId, payload)

        return

    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)


async def replace_sl(api_key, api_secret, api_passphrase, data):
    try:
        session = KucoinFunctions(api_key, api_secret, api_passphrase)

        traderId = data['traderId']
        tradeId = data['tradeId']
        document_id = data['document_id']
        payload = data['payload']

        trade_info = await get_trade_info(traderId, tradeId)
        symbol = trade_info["symbol"]
        side = trade_info["side"]
        leverage = trade_info["leverage"]
        sl_side = "sell" if side == "buy" else "buy"
        stop = "up" if side == "sell" else "down"

        precision, position, cancel = await asyncio.gather(
            session.get_precisions(symbol),
            session.get_position(symbol),
            send_cancel(session, symbol, traderId, tradeId, document_id, "sl")
        )

        position_quantity = get_position_quantity(position, trade_info)

        price = round(float(payload["sl_value"]), precision["price_precision"])

        order = Order(symbol, "market", sl_side, price, position_quantity, leverage, stop, "MP", price,
                      True)

        create_order = await session.trade_order(order)

        payload['trade_id'] = tradeId
        payload["sl_amount"] = position_quantity
        payload["order_id"] = create_order["orderId"]
        payload['sl_document_id'] = document_id

        await store_sl(traderId, payload)

        return

    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)


async def cancel_order(api_key, api_secret, api_passphrase, data):
    try:
        session = KucoinFunctions(api_key, api_secret, api_passphrase)

        traderId = data['traderId']
        tradeId = data['tradeId']
        document_id = data['document_id']
        trade_type = data['trade_type']

        trade_info = await get_trade_info(traderId, tradeId)

        symbol = trade_info["symbol"]

        await send_cancel(session, symbol, traderId, tradeId, document_id, trade_type)

        return

    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)


async def cancel_all_orders(api_key, api_secret, api_passphrase, data):
    try:
        session = KucoinFunctions(api_key, api_secret, api_passphrase)

        traderId = data['traderId']
        tradeId = data['tradeId']

        trade_info = await get_trade_info(traderId, tradeId)

        symbol = trade_info["symbol"]

        position = await session.get_position(symbol)

        quantity = get_position_quantity(position, trade_info)

        if quantity != 0:
            side = trade_info['side']
            leverage = trade_info['leverage']

            order = Order(symbol, "market", side, None, quantity, leverage, None, None, None, True)
            await session.trade_order(order)
        else:
            await session.cancel_order(trade_info['orderID'])

        await session.cancel_all_orders(symbol)

        return

    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)


async def cancel_all_tps(api_key, api_secret, api_passphrase, data):
    try:
        session = KucoinFunctions(api_key, api_secret, api_passphrase)

        traderId = data['traderId']
        tradeId = data['tradeId']

        trade_info, tp_orders = await asyncio.gather(
            get_trade_info(traderId, tradeId),
            get_tp_orders(traderId, tradeId)
        )

        await asyncio.gather(
            *[session.cancel_order(order['orderID']) for order in tp_orders])
        await asyncio.gather(
            *[delete_tp_sl_order(traderId, tradeId, order['document_id'], "tp") for order in tp_orders])
        return

    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)


async def bulk_tp(api_key, api_secret, api_passphrase, data):
    try:
        session = KucoinFunctions(api_key, api_secret, api_passphrase)

        traderId = data['traderId']
        tradeId = data['tradeId']
        take_profits = data['take_profits']

        trade_info = await get_trade_info(traderId, tradeId)

        symbol = trade_info["symbol"]
        side = trade_info["side"]
        leverage = trade_info["leverage"]
        tp_side = "sell" if side == "buy" else "buy"
        stop = "up" if side == "sell" else "down"

        position, precision = await asyncio.gather(
            session.get_position(symbol),
            session.get_precisions(symbol)
        )

        position_quantity = get_position_quantity(position, trade_info)

        new_take_profits = await calculate_tp_amounts(take_profits, position_quantity, precision)

        prepared_orders = []

        for tp in new_take_profits:
            tp_price = round(float(tp['tp_value']), precision["price_precision"])
            tp_order = Order(symbol, "market", tp_side, tp_price, tp['tp_amount'], leverage, stop, "MP", tp_price,
                             True)
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


async def partial_close(api_key, api_secret, api_passphrase, data):
    try:
        session = KucoinFunctions(api_key, api_secret, api_passphrase)

        traderId = data['traderId']
        tradeId = data['tradeId']
        percentage = data['percentage']

        trade_info, tp_sl_orders = await asyncio.gather(
            get_trade_info(traderId, tradeId),
            get_tp_sl_orders(traderId, tradeId)
        )

        symbol = trade_info["symbol"]
        side = trade_info["side"]
        leverage = trade_info["leverage"]
        tp_sl_side = "sell" if side == "buy" else "buy"
        stop = "up" if side == "sell" else "down"

        # Split tp_sl_orders into tp/sl orders
        tp_orders = [order for order in tp_sl_orders if order['trade_type'] == 'tp']
        sl_orders = [order for order in tp_sl_orders if order['trade_type'] == 'sl']

        # Fetch the curre position and precisions
        position, precision = await asyncio.gather(
            session.get_position(symbol),
            session.get_precisions(symbol)
        )

        executed = True if float(position['positionAmt']) != 0 else False

        position_quantity = get_position_quantity(position, trade_info)

        quantity_to_sell = round(position_quantity * float(percentage), precision["quantity_precision"])
        new_quantity = round(position_quantity - quantity_to_sell, precision["quantity_precision"])

        tps_data = await get_tps_status(session, tp_orders, trade_info)

        take_profits = distribute_percentages(tps_data)

        new_take_profits = await calculate_tp_amounts(take_profits, new_quantity, precision)

        await session.cancel_all_orders(symbol)

        if executed:
            sell_order = Order(symbol, "market", side, None, quantity_to_sell, leverage, None, None, None, True)
            await session.trade_order(sell_order)
            await update_trade_quantity(traderId, tradeId, new_quantity)
        else:
            order = Order(symbol, "limit", side, trade_info['entry'], new_quantity, leverage, None, None, None, False)

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
            tp_order = Order(symbol, "market", tp_sl_side, tp_price, tp['tp_amount'], leverage, stop, "MP", tp_price,
                             True)
            prepared_orders.append(tp_order)

        for sl in sl_orders:
            sl_price = round(float(sl['sl_value']), precision["price_precision"])
            sl['sl_amount'] = round(float(new_quantity) * float(sl['sl_percentage']), precision["quantity_precision"])
            sl_order = Order(symbol, "market", tp_sl_side, sl_price, sl['sl_amount'], leverage, stop, "MP", sl_price,
                             True)
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
            sl_order_dict['order_id'] = order_ids[i]['orderId']
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
