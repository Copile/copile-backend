from kucoin_futures.client import Trade, Market

api_key = "637967ef0adca800011fd0a6"
api_secret = "11b7ceaf-7a2a-4134-8503-247642a01fe3"
api_passphrase = "mira12345678"


def send_emergency(account_id, symbol, order_id):

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

    if quantity != "0" or 0:
        side = 'sell' if position['currentQty'] > 0 else 'buy'

        # Placing Stop order
        try:
            stop_order = client_trade.create_market_order(
                symbol=symbol,
                size=quantity,
                side=side,
                lever=leverage,
                type='market',
                reduce_only=True,
            )
            print(stop_order)
            return f"Stopped trade {symbol} for {account_id}"
        except Exception as error:
            print(error)
    else:

        # Cancelling open order
        try:
            cancel = client_trade.cancel_order(
                orderId=order_id,
            )
            print(cancel)
            return f"Cancelled order ID: {str(order_id)} for {account_id}"
        except Exception as error:
            print(error)

