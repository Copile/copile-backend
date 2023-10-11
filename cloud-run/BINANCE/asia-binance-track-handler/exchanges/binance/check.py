from .binlib.um_futures import UMFutures
from ..firestore_functions import get_user_keys
from ..create_cloud_task import create_task
from .profit import send_profit
from .stoploss import send_stoploss
from .precision import get_precision
from .position import get_position
import asyncio

async def check_trade(account_id, trade_id, document_id, payload, trade_info, endpoint, user_type):
    keys = await get_user_keys(account_id, "binance")
    symbol = trade_info["symbol"]

    position, precision = await asyncio.gather(
        get_position(account_id, symbol, trade_info, keys),
        get_precision(account_id, symbol, keys)
    )

    if float(position) != 0:
        if "tp" in endpoint:
            await send_profit(account_id, trade_id, document_id, payload["tp_number"], payload["tp_value"], payload["tp_percentage"], payload["tp_amount"], position, trade_info, precision, keys)
        else:
            await send_stoploss(account_id, trade_id, document_id, payload["sl_number"], payload["sl_value"], payload["sl_percentage"], payload["sl_amount"], position, trade_info, precision, keys)
    else:
        await create_task(account_id, trade_id, document_id, payload, endpoint, 2, user_type)

async def check_trades(account_id, trade_id, take_profits, trade_info, endpoint, user_type):
    keys = await get_user_keys(account_id, "binance")
    symbol = trade_info["symbol"]

    position, precision = await asyncio.gather(
        get_position(account_id, symbol, trade_info, keys),
        get_precision(account_id, symbol, keys)
    )

    if float(position) != 0:
        tasks = [send_profit(account_id, trade_id, tp_data["tp_id"], tp_data["tp_number"], tp_data["tp_value"], tp_data["tp_percentage"], tp_data["tp_amount"], position, trade_info, precision, keys) for tp_data in take_profits]
        await asyncio.gather(*tasks)
    else:
        await create_task(account_id, trade_id, None, take_profits, endpoint, 2, user_type)
