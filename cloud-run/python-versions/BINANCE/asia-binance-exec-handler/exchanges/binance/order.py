from .binlib.um_futures import UMFutures
from ..firestore_functions import get_tp_sl_info

async def get_order_quantity(account_id, trade_id, document_id, trade_info, keys):
    symbol = trade_info['symbol']

    client = UMFutures(key=keys['api_key'], secret=keys['api_secret'])

    tp_sl_info = await get_tp_sl_info(account_id, trade_id, document_id, "tp")
    order_id = tp_sl_info["orderID"]
    position = await client.query_order(symbol=symbol, orderId=int(order_id))
    quantity = position['origQty']
    return quantity

async def get_order_status(account_id, trade_id, document_id, trade_info, keys):
    symbol = trade_info['symbol']

    client = UMFutures(key=keys['api_key'], secret=keys['api_secret'])

    tp_sl_info = await get_tp_sl_info(account_id, trade_id, document_id, "tp")
    order_id = tp_sl_info["orderID"]
    position = await client.query_order(symbol=symbol, orderId=int(order_id))
    status = position['status']
    if status == "NEW":
        return "active"
    else:
        return "filled"
    
async def get_tps_status(tp_sl_orders, trade_info, keys):
    symbol = trade_info["symbol"]
    
    client = UMFutures(key=keys['api_key'], secret=keys['api_secret'])

    open_orders = await client.get_open_orders(symbol=symbol)

    tps_data = []

    for tp_order in tp_sl_orders:
        if "tp_number" in tp_order:
            tp_order_id = tp_order["orderID"]
            matching_open_orders = [open_order for open_order in open_orders if open_order["orderId"] == tp_order_id]
            tp_order["tp_status"] = "active" if matching_open_orders and matching_open_orders[0]["status"] == "NEW" else "filled"
            tps_data.append(tp_order)
    return tps_data
            