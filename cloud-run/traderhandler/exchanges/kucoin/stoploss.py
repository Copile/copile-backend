from kucoin_futures.client import Trade

api_key = "637967ef0adca800011fd0a6"
api_secret = "11b7ceaf-7a2a-4134-8503-247642a01fe3"
api_passphrase = "mira12345678"


def kucoin_stoploss(uuid, symbol, SL, SL_Percentage):

    # Connecting to Kucoin API
    client_trade = Trade(key=api_key, secret=api_secret, passphrase=api_passphrase, is_sandbox=False, url='')

    # Fixing symbol, because of exceptions
    if symbol == "BTCUSDT":
        symbol = "XBTUSDTM"
    else:
        symbol = f"{symbol}M"

    position = client_trade.get_position_details(
        symbol=symbol,
    )
    leverage = str(position['realLeverage'])
    quantity = position['currentQty'] if position['currentQty'] > 0 else position['currentQty'] * (-1)
    side = 'sell' if position['currentQty'] > 0 else 'buy'
    SL_amount = int(float(quantity) * float(SL_Percentage))

    # Placing Stop-loss Limit Order
    try:
        SL_order = client_trade.create_limit_order(
            symbol=symbol,
            size=SL_amount,
            side=side,
            lever=leverage,
            price=str(SL),
            stop="down" if side == "sell" else "up",
            stopPriceType="TP",
            stopPrice=str(SL),
            type='market',
            reduce_only=True,
        )
        print(SL_order)
        return f"Successfully placed Stoploss {SL} Order for {uuid}"
    except Exception as error:
        print(error)
