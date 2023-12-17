import asyncio
import logging
from ..api.perpetual import BinanceFunctions
from utils.firestore import store_tp, get_trade_info
from utils.message import message_bulk_tp
from utils.notification import notification_bulk_tp
from ..scripts.order_factory import Order
from ..scripts.settings import get_position_quantity
from ..scripts.distribution import calculate_tp_amounts

logger = logging.getLogger(__name__)


async def bulk_tp(api_key, api_secret, data):
    try:
        # Creating session for bingx api
        session = BinanceFunctions(api_key, api_secret)

        traderId = data['traderId']
        tradeId = data['tradeId']
        take_profits = data['take_profits']

        # Fetching the trade info from firestore
        trade_info = await get_trade_info(traderId, tradeId)
        symbol = trade_info["symbol"]

        # Preparing position sides for take-profits
        tp_side = "BUY" if trade_info['side'] == "SELL" else "SELL"

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
            tp_order = Order(symbol, "TAKE_PROFIT_MARKET", tp_side, None, tp['tp_amount'], tp_price, True)
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

        notification = {
            "data": {
                "take_profits": new_take_profits
            },
            "trade_id": tradeId,
            "user_id": traderId
        }

        await notification_bulk_tp(traderId, tradeId, new_take_profits)

        return message_bulk_tp(tradeId, new_take_profits_with_ids)

    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)
