from .kuclib.client import Trade
from .clear import clear_orders

async def send_emergency(account_id, trade_id, trade_info, keys):
    symbol = trade_info["symbol"]
    order_id = trade_info["orderID"]
    # Connecting to Kucoin API
    client_trade = Trade(key=keys['api_key'], secret=keys['api_secret'], passphrase=keys['api_passphrase'],
                         is_sandbox=False, url='')

    position = await client_trade.get_position_details(
        symbol=symbol,
    )
    leverage = str(position['realLeverage'])
    quantity = position['currentQty'] if position['currentQty'] > 0 else position['currentQty'] * (-1)

    if str(quantity) != "0":
        side = 'sell' if position['currentQty'] > 0 else 'buy'

        # Placing Stop order
        try:
            await client_trade.create_market_order(
                symbol=symbol,
                size=quantity,
                side=side,
                leverage=leverage,
                type='market',
                reduce_only=True,
            )
            await clear_orders(account_id, trade_id, trade_info, keys)
            return f"Stopped trade {symbol} for {account_id}"
        except Exception as error:
            print(error)
    else:

        # Cancelling open order
        try:
            cancel = await client_trade.cancel_order(
                orderId=order_id,
            )
            await clear_orders(account_id, trade_id, trade_info, keys)
            return f"Cancelled order ID: {str(order_id)} for {account_id}"
        except Exception as error:
            print(error)
