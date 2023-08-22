from pybit.unified_trading import HTTP
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
    quantity = session.get_open_orders(category="linear", symbol=symbol, orderId=str(order_id))["result"]["list"][0]["qty"]
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
    status = session.get_open_orders(category="linear", symbol=symbol, orderId=str(order_id))["result"]["list"][0]["orderStatus"]
    if status == "New" or "Created" or "Active" or "Untriggered":
        return "active"
    else:
        return "filled"