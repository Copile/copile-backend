from kucoin_futures.client import Trade, Market
from ..firestore_functions import get_user_keys, get_trade_info


def send_emergency(account_id, symbol, order_id):
    keys = get_user_keys(account_id, "bybit")

    trade_info = get_trade_info(account_id, trade_id)
    symbol = trade_info["symbol"]
    side = trade_info["side"]
    # Connecting to Kucoin API
    client_trade = Trade(key=keys['api_key'], secret=keys['api_secret'], passphrase=keys['api_passphrase'],
                         is_sandbox=False, url='')
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
