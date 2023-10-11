from .binlib.um_futures import UMFutures
from ..firestore_functions import store_sl_exec
import asyncio

async def send_stoploss(account_id, trade_id, sl_document_id, sl_number, sl_value, sl_percentage, sl_amount, position, trade_info, precision, keys):
    try:
        symbol = trade_info['symbol']
        side = trade_info['side']
            
        client = UMFutures(key=keys['api_key'], secret=keys['api_secret'])

        for i in range(len(precision)):
            if precision[i]['symbol'] == symbol:
                pricePrecision = precision[i]['pricePrecision']
                quantityPrecision = precision[i]['quantityPrecision']
        
        if sl_amount == None:
            sl_amount = round(float(position) * float(sl_percentage), quantityPrecision)
        
        
        sl_order = await client.new_order(
            symbol=symbol,
            type="STOP_MARKET",
            side="SELL" if side == "Buy" else "BUY",
            stopPrice=round(float(sl_value), pricePrecision),
            quantity=sl_amount,
            reduceOnly=True
        )
        order_id = sl_order["orderId"]
        sl_dict = {
            "order_id": order_id,
            "trade_id": trade_id,
            "sl_document_id": sl_document_id,
            "sl_number": sl_number,
            "sl_value": sl_value,
            "sl_percentage": sl_percentage,
            "sl_amount": sl_amount
        }
        await store_sl_exec(account_id, sl_dict)
        return f"Successfully placed Stoploss {sl_value} Order for {account_id}"
    except Exception as error:
        print(error)