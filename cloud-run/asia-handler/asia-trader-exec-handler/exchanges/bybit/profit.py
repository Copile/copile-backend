from pybit.unified_trading import HTTP
from ..firestore_functions import store_tp
import time
import asyncio

async def send_profit(account_id, trade_id, tp_document_id, tp_number, tp_value, tp_percentage, tp_amount, trade_info, keys):
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

    tp_amount = round(float(position) * float(tp_percentage), quantity_precision) if str(tp_amount) == "0" else tp_amount

    tp_order = session.place_order(
        category="linear",
        side='Sell' if side == 'Buy' else 'Buy',
        symbol=symbol,
        orderType="Limit",
        price=round(float(tp_value), price_precision),
        triggerDirection=2 if side == "Sell" else 1,
        triggerPrice=round(float(tp_value), price_precision),
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
    await store_tp(account_id, tp_dict)
    return f"Successfully placed Take-Profit {tp_value} Order for {account_id}"