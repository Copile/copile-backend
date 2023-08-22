from pybit.unified_trading import HTTP
from ..firestore_functions import get_user_keys
from ..create_cloud_task import create_task
from .profit import send_profit
from .stoploss import send_stoploss
import asyncio

async def check_trade(account_id, trade_id, document_id, payload, trade_info, endpoint):
    keys = await get_user_keys(account_id, "bybit")
    symbol = trade_info["symbol"]
    side = trade_info["side"]

    # Connecting to Bybit API
    session = HTTP(
        testnet=False,
        api_key=keys["api_key"],
        api_secret=keys["api_secret"],
    )

    position = str(session.get_positions(category="linear", symbol=symbol)['result']['list'][0 if side == 'Buy' else 1]['size'])

    if position != '0':
        if "tp" in endpoint:
            await send_profit(account_id, trade_id, document_id, payload["tp_number"], payload["tp_value"], payload["tp_percentage"], payload["tp_amount"], trade_info, keys)
        else:
            await send_stoploss(account_id, trade_id, document_id, payload["sl_number"], payload["sl_value"], payload["sl_percentage"], payload["sl_amount"], trade_info, keys)
    else:
        create_task(account_id, trade_id, document_id, payload, endpoint, 2)
