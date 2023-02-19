from kucoin_futures.client import Trade

api_key = "637967ef0adca800011fd0a6"
api_secret = "11b7ceaf-7a2a-4134-8503-247642a01fe3"
api_passphrase = "mira12345678"


def send_profit(acccount_id, symbol, TP, TP_Percentage):

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
    quantity = position['currentQty'] if position['currentQty'] > 0 else position['currentQty']*(-1)
    side = 'sell' if position['currentQty'] > 0 else 'buy'
    TP_amount = int(float(quantity) * float(TP_Percentage))

    # Placing Take-Profit Limit Order
    try:
        TP_order = client_trade.create_limit_order(
            symbol=symbol,
            size=TP_amount,
            price=str(TP),
            stop="up" if side == "sell" else "down",
            stopPriceType="TP",
            stopPrice=str(TP),
            side=side,
            lever=leverage,
            type='market',
            reduce_only=True,
        )
        print(TP_order)
        return f"Successfully placed Take-Profit {TP} Order for {acccount_id}"
    except Exception as error:
        print(error)

