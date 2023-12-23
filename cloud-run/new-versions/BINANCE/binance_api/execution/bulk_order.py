import asyncio
import logging
from ..api.perpetual import BinanceFunctions
from utils.firestore import store_trade, store_tp, store_sl
from utils.message import message_bulk_order
from utils.notification import notification_bulk_order
from utils.margin import get_margin
from ..scripts.order_factory import Order
from ..scripts.distribution import calculate_tp_amounts
from ..scripts.margin_mode import switch_margin_mode

logger = logging.getLogger(__name__)

async def bulk_order(api_key, api_secret, data):
    try:
        # Creating session for binance api
        session = BinanceFunctions(api_key, api_secret)

        user_id = data['user_id']
        tradeId = data['tradeId']
        plan_id = data['plan_id']
        worker_id = data['worker_id']
        margin = await get_margin(session, user_id, plan_id, worker_id)
        trader_exchange = data['trader_exchange']
        margin_type = data['margin_type']

        symbol = data['payload']['symbol']
        side = data['payload']['side'].upper()
        leverage = data['payload']['leverage']
        entry = data['payload']['entry']
        take_profits = data['payload']['take_profits']
        stop_losses = data['payload']['stop_losses']

        # Order type of initial order
        order_type = "LIMIT" if entry != "market" else "MARKET"

        # Fetching precision for specific symbol
        # Setting leverage for trade as well as margin mode (ISOLATED, CROSSED)
        precision, set_leverage, margin_mode = await asyncio.gather(
            session.get_precisions(symbol),
            session.set_leverage(symbol, leverage),
            switch_margin_mode(session, symbol, margin_type)
        )

        # Calculating quantity when the entry is either market or specific price
        quantity = round((float(margin) * int(leverage) / float(entry)),
                         precision["quantity_precision"]) if entry != "market" else round(
            (float(margin) * int(leverage) / await session.get_market(symbol)), precision["quantity_precision"])

        # Order object for initial order
        initial_order = Order(symbol, order_type, side, entry if entry != 'market' else None, quantity, None, False)

        # Adding all orders to an array for execution
        prepared_orders = [initial_order]

        # Calculating new take-profits for trade
        new_take_profits = calculate_tp_amounts(take_profits, quantity, precision)

        # Preparing position sides for take-profits and stop-losses
        tp_sl_side = "SELL" if side == "BUY" else "BUY"

        # Preparing/Adding take-profits to orders array
        for tp in new_take_profits:
            tp_price = round(float(tp['tp_value']), precision["price_precision"])
            tp_order = Order(symbol, "TAKE_PROFIT_MARKET", tp_sl_side, None, tp['tp_amount'], tp_price, True)
            prepared_orders.append(tp_order)

        # Preparing/Adding stop-losses to orders array
        for sl in stop_losses:
            sl_price = round(float(sl['sl_value']), precision["price_precision"])
            sl['sl_amount'] = round(float(quantity) * float(sl['sl_percentage']), precision["quantity_precision"])
            sl_order = Order(symbol, "STOP_MARKET", tp_sl_side, None, sl['sl_amount'], sl_price, True)
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

        await notification_bulk_order(user_id, tradeId, trade_info, new_take_profits, stop_losses)

        return message_bulk_order(tradeId, trade_info, new_take_profits_with_ids, stop_losses_with_ids)

    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)