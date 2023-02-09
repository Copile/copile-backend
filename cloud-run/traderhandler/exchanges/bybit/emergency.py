from pybit import usdt_perpetual


def send_emergency(uuid, side, symbol):
    side = 'BUY' if side == 'Buy' else 'SELL'

    session = usdt_perpetual.HTTP(
        endpoint='https://api.bybit.com',
        api_key="i8x20EPFOccGzd2myU",
        api_secret="Z122p2lilBSaDPnAwKKvP0FNFnwhZFNidGfS",
    )
    position = str(session.my_position(symbol=symbol)['result'][0 if side == 'BUY' else 1]['size'])
    if position != '0':
        try:
            stop = session.place_active_order(
                side='Buy' if side == 'Sell' else 'Sell',
                symbol=symbol,
                order_type="Market",
                qty=float(position),
                time_in_force="GoodTillCancel",
                reduce_only=True,
                close_on_trigger=False,
            )
            print(stop)
            return
        except Exception as error:
            print(error)
    elif position == '0':
        order_id = str(session.my_position(symbol=symbol)['result'][0 if side == 'BUY' else 1]['data'][0]['order_id'])
        try:
            stop = session.cancel_active_order(
                symbol=symbol,
                order_id=order_id
            )
            print(stop)
            return
        except Exception as error:
            print(error)
