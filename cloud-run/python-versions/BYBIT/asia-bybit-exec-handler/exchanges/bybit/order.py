from .pybit.unified_trading import HTTP
from ..firestore_functions import get_tp_sl_info
import asyncio

async def get_order_quantity(account_id, trade_id, document_id, trade_info, keys):
    symbol = trade_info["symbol"]

    # Connecting to Bybit API
    session = HTTP(
        testnet=False,
        api_key=keys["api_key"],
        api_secret=keys["api_secret"],
    )

    tp_sl_info = await get_tp_sl_info(account_id, trade_id, document_id, "tp")
    order_id = tp_sl_info["orderID"]
    fetch = await session.get_open_orders(category="linear", symbol=symbol, orderId=str(order_id))
    quantity = fetch["result"]["list"][0]["qty"]
    return quantity

async def get_order_status(account_id, trade_id, document_id, trade_info, keys):
    symbol = trade_info["symbol"]

    # Connecting to Bybit API
    session = HTTP(
        testnet=False,
        api_key=keys["api_key"],
        api_secret=keys["api_secret"],
    )

    tp_sl_info = await get_tp_sl_info(account_id, trade_id, document_id, "tp")
    order_id = tp_sl_info["orderID"]
    fetch = await session.get_open_orders(category="linear", symbol=symbol, orderId=str(order_id))
    status = fetch["result"]["list"][0]["orderStatus"]
    
    active_status = ["New", "Created", "Active", "Untriggered"]
    if status in active_status:
        return "active"
    else:
        return "filled"

async def get_tps_status(tp_sl_orders, trade_info, keys):
    symbol = trade_info["symbol"]
    
    session = HTTP(testnet=False, api_key=keys["api_key"], api_secret=keys["api_secret"])

    fetch = await session.get_open_orders(category="linear", symbol=symbol)
    open_orders = fetch['result']['list']
    
    tps_data = []
    active_status = ["New", "Created", "Active", "Untriggered"]

    for tp_order in tp_sl_orders:
        if "tp_number" in tp_order:
            tp_order_id = tp_order["orderID"]
            matching_open_orders = [open_order for open_order in open_orders if open_order["orderId"] == tp_order_id]
            tp_order["tp_status"] = "active" if matching_open_orders and matching_open_orders[0]["orderStatus"] in active_status else "filled"
            tps_data.append(tp_order)
    return tps_data
            