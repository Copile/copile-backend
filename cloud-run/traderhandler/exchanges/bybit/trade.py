from pybit import usdt_perpetual


def send_trade(account_id, side, symbol, leverage, Margin, price):
    side = "Buy" if side == "BUY" else "Sell"

    # Connecting to Bybit API
    session = usdt_perpetual.HTTP(
        endpoint='https://api.bybit.com',
        api_key="i8x20EPFOccGzd2myU",
        api_secret="Z122p2lilBSaDPnAwKKvP0FNFnwhZFNidGfS",
    )
    min_qty = session.query_symbol()['result']
    for item in min_qty:
        if item['name'] == symbol:
            p = len(str(item['lot_size_filter']['min_trading_qty']).split(".")[1])
            precision = int(p)
    quantity = round((float(Margin) * int(leverage) / float(price)), precision)
    # Changing leverage or Margin mode to Isolated/Cross
    try:
        leverage = session.set_leverage(
            symbol=symbol,
            buy_leverage=int(leverage),
            sell_leverage=int(leverage)
        )
    except Exception as error:
        print(f"Leverage set - {account_id}")
    try:
        mode = session.cross_isolated_margin_switch(
            symbol=symbol,
            is_isolated=False,
        )
    except Exception as error:
        print(f"Switched to Cross-Margin - {account_id}")

    # Creating order and placing all necessary Take profit positions
    try:
        create_order = session.place_active_order(
            side=side,
            symbol=symbol,
            order_type="Limit",
            price=price,
            qty=quantity,
            time_in_force="GoodTillCancel",
            reduce_only=False,
            close_on_trigger=False,
        )
        print(create_order['result']['order_id'])
        return f"**Successfully placed order! - {account_id} - {symbol}**"
    except Exception as error:
        print(format(error))
