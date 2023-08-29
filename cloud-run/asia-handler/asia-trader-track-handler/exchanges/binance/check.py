from .binlib.um_futures import UMFutures
from ..firestore_functions import get_user_keys
from ..create_cloud_task import create_task
from .profit import send_profit
from .stoploss import send_stoploss
import asyncio

async def check_trade(account_id, trade_id, document_id, payload, trade_info, endpoint):
    keys = await get_user_keys(account_id, "binance")
    symbol = trade_info["symbol"]
    side = trade_info["side"]

    client = UMFutures(key=keys['api_key'], secret=keys['api_secret'])

    position = await client.get_position_risk(symbol=symbol)
    quantity = position[0]['positionAmt']
    if float(quantity) != 0:
        if "tp" in endpoint:
            await send_profit(account_id, trade_id, document_id, payload["tp_number"], payload["tp_value"], payload["tp_percentage"], payload["tp_amount"], trade_info, keys)
        else:
            await send_stoploss(account_id, trade_id, document_id, payload["sl_number"], payload["sl_value"], payload["sl_percentage"], payload["sl_amount"], trade_info, keys)
    else:
        await create_task(account_id, trade_id, document_id, payload, endpoint, 2)
