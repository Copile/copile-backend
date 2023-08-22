from kucoin_futures.client import Trade
from ..firestore_functions import get_user_keys
from ..create_cloud_task import create_task
from .profit import send_profit
from .stoploss import send_stoploss
import asyncio

async def check_trade(account_id, trade_id, document_id, payload, trade_info, endpoint):
    keys = await get_user_keys(account_id, "kucoin")
    symbol = trade_info["symbol"]

    client_trade = Trade(key=keys['api_key'], secret=keys['api_secret'], passphrase=keys['api_passphrase'],
                         is_sandbox=False, url='')

    position_details = client_trade.get_position_details(
        symbol=symbol,
    )

    position = position_details['currentQty'] if position_details['currentQty'] > 0 else position_details['currentQty'] * (-1)

    if str(position) != '0':
        if "tp" in endpoint:
            await send_profit(account_id, trade_id, document_id, payload["tp_number"], payload["tp_value"], payload["tp_percentage"], None, trade_info, keys)
        else:
            await send_stoploss(account_id, trade_id, document_id, payload["sl_number"], payload["sl_value"], payload["sl_percentage"], None, trade_info, keys)
    else:
        await create_task(account_id, trade_id, document_id, payload, endpoint, 2)
