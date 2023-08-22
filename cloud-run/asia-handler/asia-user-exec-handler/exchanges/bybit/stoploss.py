from pybit.unified_trading import HTTP
import time
from ..firestore_functions import store_sl
import asyncio

async def send_stoploss(account_id, trade_id, sl_document_id, sl_number, sl_value, sl_percentage, sl_amount, trade_info, keys):
    symbol = trade_info["symbol"]
    side = trade_info["side"]

    # Connecting to Bybit API
    session = HTTP(
        testnet=False,
        api_key=keys["api_key"],
        api_secret=keys["api_secret"],
    )

    fetch = session.get_positions(category="linear", symbol=symbol)['result']['list'][0 if side == 'Buy' else 1]

    if str(fetch['tpslMode']) != "Partial":
        try:
            partial_mode = session.set_tp_sl_mode(
                symbol=symbol,
                tpSlMode="Partial"
            )
        except Exception as error:
            pass

    position = str(fetch['size'])
    
    coin_info = session.get_instruments_info(category="linear", symbol=symbol)['result']['list'][0]
    min_qty = coin_info["lotSizeFilter"]['minOrderQty']
    price_precision = int(coin_info["priceScale"])
    quantity_precision = 0 if float(coin_info["lotSizeFilter"]["qtyStep"]).is_integer() else int(len(str(coin_info["lotSizeFilter"]["qtyStep"]).split(".")[1]))

    sl_amount = round(float(position) * float(sl_percentage), quantity_precision) if sl_amount is None else sl_amount

    sl_order = session.place_order(
        category="linear",
        side='Sell' if side == 'Buy' else 'Buy',
        symbol=symbol,
        orderType="Limit",
        price=round(float(sl_value), price_precision),
        triggerDirection=1 if side == "Sell" else 2,
        triggerPrice=round(float(sl_value), price_precision),
        triggerBy="MarkPrice",
        qty=sl_amount,
        timeInForce="GTC",
        reduceOnly=True,
        closeOnTrigger=True,
    )
    order_id = sl_order['result']['orderId']
    sl_dict = {
        "order_id": order_id,
        "trade_id": trade_id,
        "sl_document_id": sl_document_id,
        "sl_number": sl_number,
        "sl_value": sl_value,
        "sl_percentage": sl_percentage,
        "sl_amount": sl_amount
    }
    await store_sl(account_id, sl_dict)
    return f"Successfully placed Stoploss {sl_value} Order for {account_id}"