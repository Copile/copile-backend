import asyncio
from ..api.perpetual import KucoinFunctions
from utils.firestore import store_trade, store_tp, store_sl, get_trade_info, update_trade_quantity, get_tp_sl_orders
from utils.message import message_partial_close
from utils.partial import distribute_percentages
from utils.notification import notification_partial_close
from logs.logger import Logger
from ..scripts.order_factory import Order
from ..scripts.settings import get_position_quantity
from ..scripts.distribution import calculate_tp_amounts
from ..scripts.order import get_tps_status

async def partial_close(api_key, api_secret, api_passphrase, data):
    try:
        # Creating session for kucoin api
        session = KucoinFunctions(api_key, api_secret, api_passphrase)

        user_id = data['user_id']
        trade_id = data['trade_id']

        # Creating logger for info/errors
        logger = Logger(user_id, trade_id)

        logger.info(f"Starting partial close with data: {data}")

        percentage = data['percentage']

        # Fetching the trade info and current take-profits/stop-losses from firestore
        trade_info, tp_sl_orders = await asyncio.gather(
            get_trade_info(user_id, trade_id),
            get_tp_sl_orders(user_id, trade_id)
        )

        symbol = trade_info["symbol"]
        side = trade_info["side"]
        leverage = trade_info["leverage"]

        # Preparing position sides for take-profits and stop-losses
        tp_sl_side = "sell" if side == "buy" else "buy"
        stop_sl = "up" if side == "sell" else "down"
        stop_tp = "up" if side == "buy" else "down"

        # Split tp_sl_orders into tp/sl orders
        tp_orders = [order for order in tp_sl_orders if order['trade_type'] == 'tp']
        sl_orders = [order for order in tp_sl_orders if order['trade_type'] == 'sl']

        # Fetch the current position and precisions
        position, precision = await asyncio.gather(
            session.get_position(symbol),
            session.get_precisions(symbol)
        )
        position_size = position['currentQty'] if position['currentQty'] > 0 else position[
                                                                                      'currentQty'] * (-1)

        # Variable for determining if trade executed or still limit
        executed = True if float(position_size) != 0 else False

        # Fetching the current position quantity for further use
        position_quantity = get_position_quantity(position, trade_info)

        quantity_to_sell = round(position_quantity * float(percentage), precision["quantity_precision"])
        new_quantity = round(position_quantity - quantity_to_sell, precision["quantity_precision"])

        logger.info(f"Position info: {position}, quantity to sell: {quantity_to_sell}, new quantity: {new_quantity}")

        # Fetching the statuses of all take-profits for filtering active/inactive
        tps_data = await get_tps_status(session, tp_orders, trade_info)

        # Using algo to redistribute take-profits to match new quantity
        take_profits = distribute_percentages(tps_data)

        # Calculating new take-profits for replacing current ones
        new_take_profits = calculate_tp_amounts(take_profits, new_quantity, precision)

        logger.info(f"New take-profits: {new_take_profits}")

        # Cancelling all active tps/sls as well as old limit orders
        await session.cancel_all_orders(symbol)

        if executed:
            # Creating sell order object for selling partial quantity
            sell_order = Order(symbol, "market", tp_sl_side, None, quantity_to_sell, leverage, None, None, None, True)

            # Executing sell order to decrease quantity
            await session.trade_order(sell_order)

            # Updating new quantity in firestore
            await update_trade_quantity(user_id, trade_id, new_quantity)
            logger.info(f"Updated quantity in firestore: {new_quantity}")
        else:
            # Creating new limit order object to replace old order
            order = Order(symbol, "limit", side, trade_info['entry'], new_quantity, leverage, None, None, None, False)

            # Executing new limit order
            create_order = await session.trade_order(order)

            # Preparing trade info for storing in firestore
            trade_info = {
                "trade_id": trade_id,
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

            logger.info(f"Saving trade info to firestore: {trade_info}")

            # Storing trade info in firestore
            await store_trade(user_id, trade_info)

        # Arrays to store orders for execution or order id filtering
        prepared_orders = []
        new_take_profits_with_ids = []
        stop_losses_with_ids = []

        # Preparing/Adding take-profits to orders array
        for tp in new_take_profits:
            tp_price = round(float(tp['tp_value']), precision["price_precision"])
            tp_order = Order(symbol, "market", tp_sl_side, tp_price, tp['tp_amount'], leverage, stop_tp, "MP", tp_price,
                             True)
            prepared_orders.append(tp_order)

        # Preparing/Adding stop-losses to orders array
        for sl in sl_orders:
            sl_price = round(float(sl['sl_value']), precision["price_precision"])
            sl['sl_amount'] = round(float(new_quantity) * float(sl['sl_percentage']), precision["quantity_precision"])
            sl_order = Order(symbol, "market", tp_sl_side, sl_price, sl['sl_amount'], leverage, stop_sl, "MP", sl_price,
                             True)
            prepared_orders.append(sl_order)

        # Executing all orders in the orders array 
        order_ids = await asyncio.gather(*(session.trade_order(order) for order in prepared_orders))

        # Assign orderIds to take profits and stop losses
        for i, tp_order in enumerate(prepared_orders[:len(new_take_profits)]):
            tp_order_dict = vars(tp_order)
            tp_order_dict['order_id'] = order_ids[i]['orderId']
            tp_order_dict['tp_document_id'] = new_take_profits[i]['tp_id']
            tp_order_dict['tp_number'] = new_take_profits[i]['tp_number']
            tp_order_dict['tp_percentage'] = new_take_profits[i]['tp_percentage']
            tp_order_dict['tp_value'] = new_take_profits[i]['tp_value']
            tp_order_dict['tp_amount'] = new_take_profits[i]['tp_amount']
            tp_order_dict['trade_id'] = trade_id
            new_take_profits_with_ids.append(tp_order_dict)

        start_index_for_sl = len(new_take_profits)
        for i, sl_order in enumerate(prepared_orders[start_index_for_sl:], start=start_index_for_sl):
            sl_order_dict = vars(sl_order)
            sl_order_dict['order_id'] = order_ids[i]['orderId']
            sl_order_dict['sl_document_id'] = sl_orders[i - start_index_for_sl]['sl_id']
            sl_order_dict['sl_number'] = sl_orders[i - start_index_for_sl]['sl_number']
            sl_order_dict['sl_percentage'] = sl_orders[i - start_index_for_sl]['sl_percentage']
            sl_order_dict['sl_value'] = sl_orders[i - start_index_for_sl]['sl_value']
            sl_order_dict['sl_amount'] = sl_orders[i - start_index_for_sl]['sl_amount']
            sl_order_dict['trade_id'] = trade_id
            stop_losses_with_ids.append(sl_order_dict)

        # Storing take-profits and stop-losses in firestore
        tp_promises = [store_tp(user_id, tp) for tp in new_take_profits_with_ids]
        sl_promises = [store_sl(user_id, sl) for sl in stop_losses_with_ids]

        await asyncio.gather(*tp_promises, *sl_promises)

        logger.info(f"Executed partial_close successfully")

        await notification_partial_close(user_id, trade_id, percentage)

        return message_partial_close(trade_id, new_quantity, new_take_profits_with_ids, stop_losses_with_ids)

    except Exception as e:
        logger.error(e)
        raise e
