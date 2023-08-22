from kucoin_futures.client import Trade, Market
from ..firestore_functions import get_tp_sl_info, delete_tp_sl_order, delete_order, check_executed_status
import asyncio

async def get_order_quantity(account_id, trade_id, document_id, trade_info, keys):
    client_trade = Trade(key=keys['api_key'], secret=keys['api_secret'], passphrase=keys['api_passphrase'],
                         is_sandbox=False, url='')
    tp_sl_info = await get_tp_sl_info(account_id, trade_id, document_id, "tp")
    order_id = tp_sl_info["orderID"]
    quantity = client_trade.get_order_details(orderId=str(order_id))["size"]
    return quantity

async def get_order_status(account_id, trade_id, document_id, trade_info, keys):
    client_trade = Trade(key=keys['api_key'], secret=keys['api_secret'], passphrase=keys['api_passphrase'], is_sandbox=False, url='')
    tp_sl_info = await get_tp_sl_info(account_id, trade_id, document_id, "tp")
    order_id = tp_sl_info["orderID"]
    status = client_trade.get_order_details(orderId=str(order_id))["status"]

    if status == "open":
        return "active"
    else:
        return "filled"
