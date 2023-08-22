from .bingX.perpetual.v2.Perpetual import Perpetual
from ..firestore_functions import get_tp_sl_info, delete_tp_sl_order, delete_order, check_executed_status
import asyncio

async def get_order_quantity(account_id, trade_id, document_id, trade_info, keys):
    symbol = trade_info["symbol"]

    client = Perpetual(api_key=keys["api_key"], api_secret=keys["api_secret"])

    tp_sl_info = await get_tp_sl_info(account_id, trade_id, document_id, "tp")
    order_id = tp_sl_info["orderID"]
    position = client.order(symbol=symbol, orderId=int(order_id))
    quantity = position["order"]["origQty"]
    return quantity

async def get_order_status(account_id, trade_id, document_id, trade_info, keys):
    symbol = trade_info["symbol"]

    client = Perpetual(api_key=keys["api_key"], api_secret=keys["api_secret"])

    tp_sl_info = await get_tp_sl_info(account_id, trade_id, document_id, "tp")
    order_id = tp_sl_info["orderID"]
    position = client.order(symbol=symbol, orderId=int(order_id))
    status = position["order"]["status"]
    
    if status == "NEW":
        return "active"
    else:
        return "filled"