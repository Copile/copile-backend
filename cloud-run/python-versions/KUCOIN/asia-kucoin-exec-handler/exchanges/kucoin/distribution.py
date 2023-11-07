from .kuclib.client import Trade
from ..shuffle import rearrange_tps

async def calculate_tp_amounts(account_id, trade_id, take_profits, trade_info, quantity, keys):

    tps_percentage = [tp_data['tp_percentage'] for tp_data in take_profits] 

    order_id = trade_info["orderID"]

    client_trade = Trade(key=keys['api_key'], secret=keys['api_secret'], passphrase=keys['api_passphrase'],
                         is_sandbox=False, url='')

    tps_amount = []

    if quantity != 0:
        quantity = float(quantity)
    else:
        quantity = float(await client_trade.get_order_details(orderId=str(order_id))["size"])
  
    for tp in tps_percentage:
        tp_amount = float(quantity) * float(tp)
        tps_amount.append(tp_amount)
    tp_amounts = await rearrange_tps(quantity, 0, tps_amount, 1)

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