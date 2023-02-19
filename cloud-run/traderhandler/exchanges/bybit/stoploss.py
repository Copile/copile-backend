from pybit import usdt_perpetual
import time


def send_stoploss(account_id, side, symbol, SL, SL_Percentage):
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
            p = len(str(item['lot_size_filter']['min_trading_qty']).split(".")[1])
            precision = int(p)
    while True:
        time.sleep(2)
        if position != '0':
            SL_amount = round(float(position) * float(SL_Percentage), precision)
            SL_order = session.set_trading_stop(
                symbol=symbol,
                side=side,
                sl_size=SL_amount,
                stop_loss=float(SL),
            )
            print(SL_order)
            return f"Successfully placed Stoploss {SL} Order for {account_id}"

bybit_stoploss(12312312, "Buy", "BTCUSDT", 20500, "0.50")