from .binlib.um_futures import UMFutures
from ..firestore_functions import store_sl
import asyncio

async def send_stoploss(account_id, trade_id, sl_document_id, sl_number, sl_value, sl_percentage, sl_amount, trade_info, keys):
    try:
        symbol = trade_info['symbol']
        side = trade_info['side']
            
        client = UMFutures(key=keys['api_key'], secret=keys['api_secret'])

        symbol_info = await client.exchange_info()
        symbols = symbol_info['symbols']

        for i in range(len(symbols)):
            if symbols[i]['symbol'] == symbol:
                pricePrecision = symbols[i]['pricePrecision']
                quantityPrecision = symbols[i]['quantityPrecision']
        
        if sl_amount == None:
            position = await client.get_position_risk(symbol=symbol)
            quantity = abs(float(position[0]['positionAmt']))
            sl_amount = round(float(quantity) * float(sl_percentage), quantityPrecision)
        
        
        sl_order = await client.new_order(
            symbol=symbol,
            type="STOP",
            side="SELL" if side == "Buy" else "BUY",
            price=round(float(sl_value), pricePrecision),
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
        await store_sl(account_id, sl_dict)
        return f"Successfully placed Stoploss {sl_value} Order for {account_id}"
    except Exception as error:
        print(error)