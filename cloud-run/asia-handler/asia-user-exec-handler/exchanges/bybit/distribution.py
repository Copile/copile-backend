from pybit.unified_trading import HTTP
from ..shuffle import rearrange_tps
import asyncio

async def calculate_tp_amounts(account_id, trade_id, take_profits, trade_info, quantity, keys):

    tps_percentage = [tp_data['tp_percentage'] for tp_data in take_profits]
    symbol = trade_info["symbol"]
    order_id = trade_info["orderID"]

    # Connecting to Bybit API
    session = HTTP(
        testnet=False,
        api_key=keys["api_key"],
        api_secret=keys["api_secret"],
    )

    coin_info = session.get_instruments_info(category="linear", symbol=symbol)['result']['list'][0]
    min_qty = coin_info["lotSizeFilter"]['minOrderQty']
    quantity_precision = 0 if float(coin_info["lotSizeFilter"]["qtyStep"]).is_integer() else int(len(str(coin_info["lotSizeFilter"]["qtyStep"]).split(".")[1]))

    if quantity != 0:
        quantity = float(quantity)
    else:
        quantity = session.get_open_orders(category="linear", symbol=symbol, orderId=str(order_id))["result"]["list"][0]["qty"]
    tps_amount = []
    for tp in tps_percentage:
        tp_amount = float(quantity) * float(tp)
        tps_amount.append(tp_amount)
    tp_amounts = await rearrange_tps(float(quantity), quantity_precision, tps_amount, float(min_qty))

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