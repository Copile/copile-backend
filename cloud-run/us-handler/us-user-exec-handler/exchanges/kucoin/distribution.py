from kucoin_futures.client import Trade, Market
from ..shuffle import rearrange_tps
from .position import get_position
from ..firestore_functions import get_tp_sl_info, delete_tp_sl_order, delete_order, check_executed_status
import asyncio


async def calculate_tp_amounts(account_id, trade_id, take_profits, trade_info, quantity, keys):
    
    tps_percentage = [tp_data['tp_percentage'] for tp_data in take_profits] 

    symbol = trade_info["symbol"]
    order_id = trade_info["orderID"]

    client_trade = Trade(key=keys['api_key'], secret=keys['api_secret'], passphrase=keys['api_passphrase'],
                         is_sandbox=False, url='')
    client = Market(key=keys['api_key'], secret=keys['api_secret'], passphrase=keys['api_passphrase'],is_sandbox=False, url='')

    multiplier = client.get_contract_detail(symbol=symbol)['multiplier']
    min_qty = float(1 * float(multiplier))
    quantityPrecision = int(len(str(min_qty).split(".")[1])) if min_qty != 1 else 0

    tps_amount = []

    if quantity != 0:
        quantity = float(quantity)
    else:
        quantity = float(client_trade.get_order_details(orderId=str(order_id))["size"])
    
    for tp in tps_percentage:
        tp_amount = float(quantity) * float(tp)
        tps_amount.append(tp_amount)
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