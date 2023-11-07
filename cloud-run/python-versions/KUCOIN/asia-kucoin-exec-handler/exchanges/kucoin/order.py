from .kuclib.client import Trade
from ..firestore_functions import get_tp_sl_info

active_status = ["open", "active"]

async def get_order_quantity(account_id, trade_id, document_id, trade_info, keys):
    client_trade = Trade(key=keys['api_key'], secret=keys['api_secret'], passphrase=keys['api_passphrase'],
                         is_sandbox=False, url='')
    tp_sl_info = await get_tp_sl_info(account_id, trade_id, document_id, "tp")
    order_id = tp_sl_info["orderID"]
    quantity = await client_trade.get_order_details(orderId=str(order_id))["size"]
    return quantity

async def get_order_status(account_id, trade_id, document_id, trade_info, keys):
    client_trade = Trade(key=keys['api_key'], secret=keys['api_secret'], passphrase=keys['api_passphrase'], is_sandbox=False, url='')
    tp_sl_info = await get_tp_sl_info(account_id, trade_id, document_id, "tp")
    order_id = tp_sl_info["orderID"]
    status = await client_trade.get_order_details(orderId=str(order_id))["status"]
    if status in active_status:
        return "active"
    else:
        return "filled"

async def get_tps_status(tp_sl_orders, trade_info, keys):
    symbol = trade_info["symbol"]
    
    client_trade = Trade(key=keys['api_key'], secret=keys['api_secret'], passphrase=keys['api_passphrase'],
                        is_sandbox=False, url='')

    fetch = await client_trade.get_order_list(symbol=symbol)
    open_orders = fetch['items']
    
    tps_data = []

    for tp_order in tp_sl_orders:
        if "tp_number" in tp_order:
            tp_order_id = tp_order["orderID"]
            matching_open_orders = [open_order for open_order in open_orders if open_order["id"] == tp_order_id]
            tp_order["tp_status"] = "active" if matching_open_orders and matching_open_orders[0]["status"] in active_status else "filled"
            tps_data.append(tp_order)
    return tps_data
            