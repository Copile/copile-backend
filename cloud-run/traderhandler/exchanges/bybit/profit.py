from pybit import usdt_perpetual
import time


def send_profit(account_id, side, symbol, TP, TP_Percentage):
    side = 'BUY' if side == 'Buy' else 'SELL'

    API_KEY = "i8x20EPFOccGzd2myU"
    API_SECRET = "Z122p2lilBSaDPnAwKKvP0FNFnwhZFNidGfS"

    # Connecting to Bybit API
    session = usdt_perpetual.HTTP(
        endpoint='https://api.bybit.com',
        api_key=API_KEY,
        api_secret=API_SECRET
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
            TP_amount = round(float(position) * float(TP_Percentage), precision)
            TP_order = session.place_conditional_order(
                side='Sell' if side == 'BUY' else 'Buy',
                symbol=symbol,
                order_type="Limit",
                price=float(TP),
                base_price=float(TP) - min_price,
                stop_px=float(TP),
                qty=TP_amount,
                time_in_force="GoodTillCancel",
                trigger_by="MarkPrice",
                reduce_only=True,
                close_on_trigger=True,
            )
            print(TP_order['result']['stop_order_id'])
            return f"Successfully placed Take-Profit {TP} Order for {account_id}"
