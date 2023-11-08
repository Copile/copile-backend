from .binlib.um_futures import UMFutures
from ..firestore_functions import store_tp_exec
import asyncio

async def send_profit(account_id, trade_id, tp_document_id, tp_number, tp_value, tp_percentage, tp_amount, position, trade_info, precision, keys):
    try:
        symbol = trade_info['symbol']
        side = trade_info['side']

        client = UMFutures(key=keys['api_key'], secret=keys['api_secret'])

        for i in range(len(precision)):
            if precision[i]['symbol'] == symbol:
                pricePrecision = precision[i]['pricePrecision']
                quantityPrecision = precision[i]['quantityPrecision']
        
        if str(tp_amount) != "0":
            tp_amount = tp_amount
        else:
            tp_amount = round(float(position) * float(tp_percentage), quantityPrecision)

        tp_order = await client.new_order(
            symbol=symbol,
            type="TAKE_PROFIT",
            side="SELL" if side == "Buy" else "BUY",
            price=round(float(tp_value), pricePrecision),
            stopPrice=round(float(tp_value), pricePrecision),
            quantity=tp_amount,
            reduceOnly=True,
        )
        order_id = tp_order["orderId"]
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
    except Exception as error:
        print(error)