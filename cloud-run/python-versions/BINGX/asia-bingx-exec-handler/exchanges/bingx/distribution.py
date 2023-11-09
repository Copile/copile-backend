from .bingX.perpetual.v2.Perpetual import Perpetual
from ..shuffle import rearrange_tps

async def calculate_tp_amounts(account_id, trade_id, take_profits, trade_info, quantity, precisions, keys):
    try:
        tps_percentage = [tp_data['tp_percentage'] for tp_data in take_profits] 
        symbol = trade_info["symbol"]
        order_id = trade_info["orderID"]

        client = Perpetual(api_key=keys["api_key"], api_secret=keys["api_secret"])

        tps_amount = []

        precisions_dict = {precision["symbol"]: precision for precision in precisions}
        quantityPrecision = precisions_dict.get(symbol, {}).get("quantityPrecision")
        min_qty = float(precisions_dict.get(symbol, {}).get("size"))

        if quantity != 0:
            quantity = float(quantity)
        else:
            quantity = float(client.order(symbol=symbol, orderId=int(order_id))["order"]["origQty"])
        
        tps_amount = [float(quantity) * float(tp) for tp in tps_percentage]
        tp_amounts = await rearrange_tps(quantity, quantityPrecision, tps_amount, min_qty)

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
        raise Exception(f"Error calculating take-profit amounts for {account_id}: {error}")