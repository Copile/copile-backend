from pybit import usdt_perpetual
from ..firestore_functions import get_user_keys, get_trade_info, store_tp
import time


def send_profit(account_id, trade_id, tp_document_id, tp_number, tp_value, tp_percentage):
    keys = get_user_keys(account_id, "bybit")
    trade_info = get_trade_info(account_id, trade_id)
    symbol = trade_info["symbol"]
    side = trade_info["side"]

    side = 'BUY' if side == 'Buy' else 'SELL'

    # Connecting to Bybit API
    session = usdt_perpetual.HTTP(
        endpoint='https://api.bybit.com',
        api_key=keys["api_key"],
        api_secret=keys["api_secret"]
    )
    if str(session.my_position(symbol=symbol)['result'][0 if side == 'BUY' else 1]['tp_sl_mode']) != "Partial":
        try:
            partial_mode = session.full_partial_position_tp_sl_switch(
                symbol=symbol,
                tp_sl_mode="Partial"
            )
            print(partial_mode)
        except Exception as error:
            print(f"Switched Position Mode - {account_id}")

    position = str(session.my_position(symbol=symbol)['result'][0 if side == 'BUY' else 1]['size'])
    min_qty = session.query_symbol()['result']
    for item in min_qty:
        if item['name'] == symbol:
            min_price = float(item['price_filter']['min_price'])
            if float(item['lot_size_filter']['min_trading_qty']).is_integer():
                precision = 0
            else:
                p = len(str(item['lot_size_filter']['min_trading_qty']).split(".")[1])
                precision = int(p)
    while True:
        time.sleep(2)
        if position != '0':
            tp_amount = round(float(position) * float(tp_percentage), precision)
            tp_order = session.place_conditional_order(
                side='Sell' if side == 'BUY' else 'Buy',
                symbol=symbol,
                order_type="Limit",
                price=float(tp_value),
                base_price=float(tp_value) - min_price,
                stop_px=float(tp_value),
                qty=tp_amount,
                time_in_force="GoodTillCancel",
                trigger_by="MarkPrice",
                reduce_only=True,
                close_on_trigger=True,
            )
            order_id = tp_order['result']['stop_order_id']
            tp_dict = {
                "order_id": order_id,
                "trade_id": trade_id,
                "tp_document_id": tp_document_id,
                "tp_number": tp_number,
                "tp_value": tp_value,
                "tp_percentage": tp_percentage
            }
            store_tp(account_id, tp_dict)
            print(order_id)
            return f"Successfully placed Take-Profit {tp_value} Order for {account_id}"
