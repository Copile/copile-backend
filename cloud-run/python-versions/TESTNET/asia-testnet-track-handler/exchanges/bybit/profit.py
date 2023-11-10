from .pybit.unified_trading import HTTP
from ..firestore_functions import store_tp_exec
import time
import asyncio

async def send_profit(account_id, trade_id, tp_document_id, tp_number, tp_value, tp_percentage, tp_amount, position, trade_info, precision, keys):
    symbol = trade_info["symbol"]
    side = trade_info["side"]

    # Connecting to Bybit API
    session = HTTP(
        testnet=True,
        api_key=keys["api_key"],
        api_secret=keys["api_secret"],
    )
    
    pricePrecision = int(precision["priceScale"])
    quantityPrecision = 0 if float(precision["lotSizeFilter"]["qtyStep"]).is_integer() else int(len(str(precision["lotSizeFilter"]["qtyStep"]).split(".")[1]))

    if str(tp_amount) == "0":
        tp_amount = round(float(position) * float(tp_percentage), quantityPrecision)

    tp_order = await session.place_order(
        category="linear",
        side='Sell' if side == 'Buy' else 'Buy',
        symbol=symbol,
        orderType="Limit",
        price=round(float(tp_value), pricePrecision),
        triggerDirection=2 if side == "Sell" else 1,
        triggerPrice=round(float(tp_value), pricePrecision),
        triggerBy="MarkPrice",
        qty=tp_amount,
        timeInForce="GTC",
        reduceOnly=True,
        closeOnTrigger=True,
    )
    order_id = tp_order['result']['orderId']
    tp_dict = {
        "order_id": order_id,
        "trade_id": trade_id,
        "tp_document_id": tp_document_id,
        "tp_number": tp_number,
        "tp_value": tp_value,
        "tp_percentage": tp_percentage,
        "tp_amount": tp_amount
    }
    await store_tp_exec(account_id, tp_dict)
    return f"Successfully placed Take-Profit {tp_value} Order for {account_id}"