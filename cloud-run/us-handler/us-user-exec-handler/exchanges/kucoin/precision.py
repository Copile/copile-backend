from kucoin_futures.client import Trade, Market
from ..firestore_functions import store_trade
import asyncio

async def get_precision(account_id, symbol, keys):

    client = Market(key=keys['api_key'], secret=keys['api_secret'], passphrase=keys['api_passphrase'], is_sandbox=False, url='')

    if symbol.endswith("M"):
        # If the symbol already ends with "M", do nothing
        pass
    elif symbol == "BTCUSDT":
        symbol = "XBTUSDTM"
    else:
        symbol = f"{symbol}M"

        # Getting round precision for future use
    multiplier = client.get_contract_detail(symbol=symbol)['multiplier']
    min_qty = 1 * float(multiplier)
    precision = int(len(str(min_qty).split(".")[1])) if min_qty != 1 else 0
    return precision