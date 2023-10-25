from .binlib.um_futures import UMFutures
from ..firestore_functions import store_tp

async def send_profit(account_id, trade_id, tp_document_id, tp_number, tp_value, tp_percentage, tp_amount, trade_info, precision, keys):
    try:
        symbol = trade_info['symbol']
        side = trade_info['side']

        client = UMFutures(key=keys['api_key'], secret=keys['api_secret'])

        precision_dict = {item['symbol']: (item['pricePrecision'], item['quantityPrecision']) for item in precision if item['symbol'] == symbol}
        price_precision, quantity_precision = precision_dict[symbol]
        
        if str(tp_amount) != "0":
            tp_amount = tp_amount
        else:
            position = await client.get_position_risk(symbol=symbol)
            quantity = abs(float(position[0]['positionAmt']))
            tp_amount = round(float(quantity) * float(tp_percentage), quantity_precision)

        tp_order = await client.new_order(
            symbol=symbol,
            type="TAKE_PROFIT",
            side="SELL" if side == "Buy" else "BUY",
            price=round(float(tp_value), price_precision),
            stopPrice=round(float(tp_value), price_precision),
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
        await store_tp(account_id, tp_dict)
        return f"Successfully placed Take-Profit {tp_value} Order for {account_id}"
    except Exception as error:
        print(error)