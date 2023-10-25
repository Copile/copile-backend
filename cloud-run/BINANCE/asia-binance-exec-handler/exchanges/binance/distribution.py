from .binlib.um_futures import UMFutures
from ..shuffle import rearrange_tps

async def calculate_tp_amounts(account_id, trade_id, take_profits, trade_info, quantity, precision, keys):
    try:
        tps_percentage = [tp_data['tp_percentage'] for tp_data in take_profits] 
        symbol = trade_info["symbol"]
        order_id = trade_info["orderID"]

        client = UMFutures(key=keys['api_key'], secret=keys['api_secret'])

        tps_amount = []

        for i in range(len(precision)):
            if precision[i]['symbol'] == symbol:
                quantity_precision = precision[i]['quantityPrecision']
                for symbol_filter in precision[i]['filters']:
                    if symbol_filter['filterType'] == "LOT_SIZE":
                        min_qty = symbol_filter['minQty']
        
        if quantity != 0:
            quantity = float(quantity)
        else:
            position = await client.query_order(symbol=symbol, orderId=int(order_id))
            quantity = abs(float(position['origQty']))
        for tp in tps_percentage:
            tp_amount = float(quantity) * float(tp)
            tps_amount.append(tp_amount)
        tp_amounts = await rearrange_tps(quantity, quantity_precision, tps_amount, min_qty)

        new_take_profits = []

        for index, tp_data in enumerate(take_profits):
            if tp_amounts[index] > 0:
                tp_id = tp_data['document_id'] if 'document_id' in tp_data else tp_data['tp_id']
                tp_number = tp_data['tp_number']
                tp_value = tp_data['tp_value']
                tp_percentage = round(tp_amounts[index] / sum(tp_amounts), 2)
                tp_amount = tp_amounts[index]
                new_take_profits.append({
                    'tp_id': tp_id,
                    'tp_number': tp_number,
                    'tp_value': tp_value,
                    'tp_percentage': tp_percentage,
                    'tp_amount': tp_amount
                })

        return new_take_profits
    except Exception as error:
        print(error)