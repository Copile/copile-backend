import asyncio
import logging
from ..api.perpetual import KucoinFunctions
from utils.firestore import store_trade, store_tp, store_sl, get_trade_info, update_trade_quantity, get_tp_sl_orders
from utils.message import message_partial_close
from utils.partial import distribute_percentages
from utils.notification import notification_partial_close
from ..scripts.order_factory import Order
from ..scripts.settings import get_position_quantity
from ..scripts.distribution import calculate_tp_amounts
from ..scripts.order import get_tps_status

logger = logging.getLogger(__name__)


async def partial_close(api_key, api_secret, api_passphrase, data):
    try:
        # Creating session for kucoin api
        session = KucoinFunctions(api_key, api_secret, api_passphrase)

        traderId = data['traderId']
        tradeId = data['tradeId']
        percentage = data['percentage']

        # Fetching the trade info and current take-profits/stop-losses from firestore
        trade_info, tp_sl_orders = await asyncio.gather(
            get_trade_info(traderId, tradeId),
            get_tp_sl_orders(traderId, tradeId)
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
            sell_order = Order(symbol, "market", tp_sl_side, None, quantity_to_sell, leverage, None, None, None, True)

            # Executing sell order to decrease quantity
            await session.trade_order(sell_order)

            # Updating new quantity in firestore
            await update_trade_quantity(traderId, tradeId, new_quantity)
        else:
            # Creating new limit order object to replace old order
            order = Order(symbol, "limit", side, trade_info['entry'], new_quantity, leverage, None, None, None, False)

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

        await notification_partial_close(traderId, tradeId, percentage)

        return message_partial_close(tradeId, new_quantity, new_take_profits_with_ids, stop_losses_with_ids)

    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)
