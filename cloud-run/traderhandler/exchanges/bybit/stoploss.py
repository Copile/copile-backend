from pybit import usdt_perpetual
import time
from ..firestore_functions import get_user_keys, get_trade_info, store_sl


def send_stoploss(account_id, trade_id, sl_document_id, sl_number, sl_value, sl_percentage):
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
            if float(item['lot_size_filter']['min_trading_qty']).is_integer():
                precision = 0
            else:
                p = len(str(item['lot_size_filter']['min_trading_qty']).split(".")[1])
                precision = int(p)
    while True:
        time.sleep(2)
        if position != '0':
            sl_amount = round(float(position) * float(sl_percentage), precision)
            sl_order = session.place_conditional_order(
                side='Sell' if side == 'BUY' else 'Buy',
                symbol=symbol,
                order_type="Limit",
                price=float(sl_value),
                base_price=float(sl_value),
                stop_px=float(sl_value),
                qty=sl_amount,
                time_in_force="GoodTillCancel",
                trigger_by="MarkPrice",
                reduce_only=True,
                close_on_trigger=True,
            )
            order_id = sl_order['result']['stop_order_id']
            sl_dict = {
                "order_id": order_id,
                "trade_id": trade_id,
                "sl_document_id": sl_document_id,
                "sl_number": sl_number,
                "sl_value": sl_value,
                "sl_percentage": sl_percentage
            }
            store_sl(account_id, sl_dict)
            return f"Successfully placed Stoploss {sl_value} Order for {account_id}"
