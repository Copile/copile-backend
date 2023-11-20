from .bingX.perpetual.v2.Perpetual import Perpetual
from ..firestore_functions import get_tp_sl_info

async def get_order_quantity(account_id, trade_id, document_id, trade_info, keys):
    symbol = trade_info["symbol"]

    client = Perpetual(api_key=keys["api_key"], api_secret=keys["api_secret"])

    tp_sl_info = await get_tp_sl_info(account_id, trade_id, document_id, "tp")
    order_id = tp_sl_info["orderID"]
    position = await client.order(symbol=symbol, orderId=int(order_id))
    quantity = position["order"]["origQty"]
    return quantity

async def get_order_status(account_id, trade_id, document_id, trade_info, keys):
    symbol = trade_info["symbol"]

    client = Perpetual(api_key=keys["api_key"], api_secret=keys["api_secret"])

    tp_sl_info = await get_tp_sl_info(account_id, trade_id, document_id, "tp")
    order_id = tp_sl_info["orderID"]
    position = await client.order(symbol=symbol, orderId=int(order_id))
    status = position["order"]["status"]
    
    if status == "NEW":
        return "active"
    else:
        return "filled"

async def get_tps_status(tp_sl_orders, trade_info, keys):
    symbol = trade_info["symbol"]
    
    client = Perpetual(api_key=keys["api_key"], api_secret=keys["api_secret"])

    fetch_orders = await client.current_orders(symbol=symbol)
    open_orders = fetch_orders["orders"]

    tps_data = []
    active_status = ["NEW", "PARTIALLY_FILLED"]

    for tp_order in tp_sl_orders:
        if "tp_number" in tp_order:
            tp_order_id = tp_order["orderID"]
            matching_open_orders = [open_order for open_order in open_orders if str(open_order["orderId"]) == tp_order_id]
            tp_order["tp_status"] = "active" if matching_open_orders and matching_open_orders[0]["status"] in active_status else "filled"
            tps_data.append(tp_order)
    return tps_data
            