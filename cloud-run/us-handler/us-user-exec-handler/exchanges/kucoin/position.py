from kucoin_futures.client import Trade
import asyncio

async def get_position(account_id, trade_id, trade_info, keys):
    symbol = trade_info["symbol"]

    client_trade = Trade(key=keys['api_key'], secret=keys['api_secret'], passphrase=keys['api_passphrase'],
                         is_sandbox=False, url='')

    position_details = client_trade.get_position_details(
        symbol=symbol,
    )

    position = position_details['currentQty'] if position_details['currentQty'] > 0 else position_details['currentQty'] * (-1)
    if str(position) != '0':
        return position
    else:
        return 0