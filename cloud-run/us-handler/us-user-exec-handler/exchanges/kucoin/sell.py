from kucoin_futures.client import Trade, Market
import asyncio

async def sell_quantity(account_id, trade_id, quantity, trade_info, keys):
    symbol = trade_info["symbol"]

    client_trade = Trade(key=keys['api_key'], secret=keys['api_secret'], passphrase=keys['api_passphrase'],
                        is_sandbox=False, url='')

    position = client_trade.get_position_details(
        symbol=symbol,
    )
    leverage = str(position['realLeverage'])
    side = 'sell' if position['currentQty'] > 0 else 'buy'

    # Placing Stop order
    try:
        stop_order = client_trade.create_market_order(
            symbol=symbol,
            size=float(quantity),
            side=side,
            lever=leverage,
            type='market',
            reduce_only=True,
        )
        return f"Executed partial close for {symbol} for {account_id}"
    except Exception as error:
        print(error)