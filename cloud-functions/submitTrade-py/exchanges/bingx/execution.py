import asyncio
import logging
from .api.perpetual import BingXFunctions
from ...utils.firestore import store_trade, store_tp, store_sl, get_trade_info, update_trade_quantity, get_tp_sl_orders, get_tp_orders
from ...utils.partial import distribute_percentages
from .scripts.order_factory import Order
from .scripts.settings import convert_symbol, get_position_quantity
from .scripts.cancel import send_cancel
from .scripts.distribution import calculate_tp_amounts
from .scripts.order import get_tps_status

logger = logging.getLogger(__name__)

async def bulkOrder(api_key, api_secret, data):
    try:
        session = BingXFunctions(api_key, api_secret)

        traderId, tradeId, margin, trader_exchange, margin_type = data
        side, leverage, entry, take_profits, stop_losses = data["payload"]

        symbol = convert_symbol(data["payload"]["symbol"])

        order_type = "LIMIT" if entry != "market" else "MARKET"

        precision, margin_mode, set_leverage = await asyncio.gather(
            session.get_precisions(symbol),
            session.switch_margin_mode(symbol, margin_type),
            session.set_leverage(symbol, side, leverage)
        )

        quantity = round((float(margin) * int(leverage) / float(entry)), precision["quantity_precision"]) if entry != "market" else round((float(margin) * int(leverage) / float(await session.get_market(symbol))), precision["quantity_precision"])

        order_side = "LONG" if side == "Buy" else "SHORT"
        initial_order = Order(symbol, order_type, side.upper(), None if entry == "market" else entry, quantity, order_side, None, None)

        prepared_orders = [initial_order]


        new_take_profits = await calculate_tp_amounts(take_profits, quantity, precision)

        tp_sl_position_side = "LONG" if side == "Buy" else "SHORT"

        for tp in new_take_profits:
            tp.trade_id = tradeId
            tp_price = round(float(tp.tp_value), precision["price_precision"])
            tp_order = Order(symbol, "TRIGGER_MARKET", "SELL" if side == "Buy" else "BUY", None, tp.tp_amount, tp_sl_position_side, tp_price, tp_order_id)
            prepared_orders.append(tp_order)

        for sl in stop_losses:
            sl.trade_id = tradeId
            sl_price = round(float(sl.sl_value), precision["price_precision"])
            sl.sl_amount = round(float(quantity) * float(sl.sl_percentage), precision["quantity_precision"])
            sl_order = Order(symbol, "TRIGGER_MARKET", "SELL" if side == "Buy" else "BUY", None, sl.sl_amount, tp_sl_position_side, sl_price, sl_order_id)
            prepared_orders.append(sl_order)

        order_ids = await asyncio.gather(*(session.trade_order(order) for order in prepared_orders))

        # Adding orderId  to initial order
        initial_order_with_id = (initial_order, order_ids[0]["order"]["orderId"])

        new_take_profits_with_ids = []
        stop_losses_with_ids = []

        # Assign orderIds to take profits and stop losses
        for i, tp_order in enumerate(prepared_orders[1:len(new_take_profits) + 1], start=1):
            new_take_profits_with_ids.append((tp_order, order_ids[i]["order"]["orderId"]))

        for i, sl_order in enumerate(prepared_orders[len(new_take_profits) + 1:], start=len(new_take_profits) + 1):
            stop_losses_with_ids.append((sl_order, order_ids[i]["order"]["orderId"]))

        trade_info = {
            "trade_id": tradeId,
            "order_id": initial_order_with_id["orderId"],
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

        all_results = await asyncio.gather(*tp_promises, *sl_promises)

        return

    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)

async def send_sl(api_key, api_secret, data):
    try:
        session = BingXFunctions(api_key, api_secret)
        traderId, tradeId, document_id, payload = data

        trade_info = await get_trade_info(traderId, tradeId)
        
        symbol = trade_info["symbol"]
        side = trade_info["side"]
        sl_position_side = "LONG" if side.upper() == "BUY" else "SHORT"

        position, precision = await asyncio.gather(
            session.get_position(symbol),
            session.get_precisions(symbol)
        )

        position_quantity = get_position_quantity(position, trade_info)

        price = round(float(payload["sl_value"], precision["price_precision"]))

        order = Order(symbol, "TRIGGER_MARKET", "BUY" if side == "SELL" else "BUY", price, float(position_quantity), sl_position_side, None, None)

        create_order = await session.trade_order(order)

        payload["sl_amount"] = float(position_quantity)
        payload["orderId"] = create_order["order"]["orderId"]

        await store_sl(traderId, payload)

        return
    
    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)

async def replace_sl(api_key, api_secret, data):
    try:
        session = BingXFunctions(api_key, api_secret)
        traderId, tradeId, document_id, payload = data

        trade_info = await get_trade_info(traderId, tradeId)

        symbol = trade_info["symbol"]
        side = trade_info["side"]
        sl_position_side = "LONG" if side.upper() == "BUY" else "SHORT"

        # Cancel the current stoploss
        await send_cancel(session, symbol, traderId, tradeId, document_id, "sl")

        # Fetch the current position and precisions
        position, precision = await asyncio.gather(
            session.get_position(symbol),
            session.get_precisions(symbol)
        )

        position_quantity = get_position_quantity(position, trade_info)

        price = round(float(payload["sl_value"], precision["price_precision"]))

        order = Order(symbol, "TRIGGER_MARKET", "BUY" if side == "SELL" else "BUY", price, float(position_quantity), sl_position_side, None, None)

        create_order = await session.trade_order(order)

        payload["sl_amount"] = float(position_quantity)
        payload["orderId"] = create_order["order"]["orderId"]

        await store_sl(traderId, payload)

        return

    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)

async def cancel_order(api_key, api_secret, data):
    try:
        session = BingXFunctions(api_key, api_secret)
        traderId, tradeId, document_id, trade_type = data

        trade_info = await get_trade_info(traderId, tradeId)

        symbol = trade_info["symbol"]

        await send_cancel(session, symbol, traderId, tradeId, document_id, trade_type)

        return
    
    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)

async def cancel_all_orders(api_key, api_secret, data):
    try:
        session = BingXFunctions(api_key, api_secret)
        traderId, tradeId = data

        trade_info = await get_trade_info(traderId, tradeId)

        symbol = trade_info["symbol"]

        position = await session.get_position(symbol)
    
        if len(position) != 0:
            quantity = position[0]["positionAmt"]
            position_side = position[0]["positionSide"]

            emergency_side = "SELL" if position_side == "LONG" else "BUY"

            emergency_order = Order(symbol, "MARKET", emergency_side, None, quantity, position_side, None, None)

            emergency = await session.trade_order(emergency_order)
        else:
            await session.cancel_order(symbol, trade_info["orderID"], None)

        await session.cancel_all_orders(symbol)

        return

    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)

async def cancel_all_tps(api_key, api_secret, data):
    try:
        session = BingXFunctions(api_key, api_secret)

        traderId, tradeId = data

        trade_info, tp_orders = await asyncio.gather(
            get_trade_info(traderId, tradeId),
            get_tp_orders(traderId, tradeId)
        )

        await asyncio.gather(*[session.cancelOrder(trade_info["symbol"], None, order.orderID) for order in tp_orders])

        return

    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)

async def bulk_tp(api_key, api_secret, data):
    try:
        session = BingXFunctions(api_key, api_secret)
        traderId, tradeId, take_profits = data

        trade_info = await get_trade_info(traderId, tradeId)

        symbol = trade_info["symbol"]
        side = trade_info["side"]
        tp_postion_side = "LONG" if side == "BUY" else "SHORT"

        # Fetch the current position and precisions
        position, precision = await asyncio.gather(
            session.get_position(symbol),
            session.get_precisions(symbol)
        )

        postion_quantity = get_position_quantity(position, trade_info)

        new_take_profits = await calculate_tp_amounts(take_profits, postion_quantity, precision)

        prepared_orders = []

        
        

    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)