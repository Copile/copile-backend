from .pybit.unified_trading import HTTP
import time
from ..firestore_functions import store_sl
import asyncio

async def send_stoploss(account_id, trade_id, sl_document_id, sl_number, sl_value, sl_percentage, sl_amount, trade_info, precision, keys):
    try:
        symbol = trade_info["symbol"]
        side = trade_info["side"]

        # Connecting to Bybit API
        session = HTTP(
            testnet=False,
            api_key=keys["api_key"],
            api_secret=keys["api_secret"],
        )
        
        pricePrecision = int(precision["priceScale"])
        quantityPrecision = 0 if float(precision["lotSizeFilter"]["qtyStep"]).is_integer() else int(len(str(precision["lotSizeFilter"]["qtyStep"]).split(".")[1]))

        if sl_amount is None:
            fetch = await session.get_positions(category="linear", symbol=symbol)
            position = fetch['result']['list'][0]['size']
            sl_amount = round(float(position) * float(sl_percentage), quantityPrecision)
        
        sl_order = await session.place_order(
            category="linear",
            side='Sell' if side == 'Buy' else 'Buy',
            symbol=symbol,
            orderType="Limit",
            price=round(float(sl_value), pricePrecision),
            triggerDirection=1 if side == "Sell" else 2,
            triggerPrice=round(float(sl_value), pricePrecision),
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
    except Exception as error:
        print(error)