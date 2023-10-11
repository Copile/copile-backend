from .kuclib.client import Market
from .settings import reformat_symbol

async def get_precision(symbol, keys):

    client = Market(key=keys['api_key'], secret=keys['api_secret'], passphrase=keys['api_passphrase'], is_sandbox=False, url='')

    symbol = reformat_symbol(symbol)

    fetch = await client.get_contract_detail(symbol=symbol)
    multiplier = fetch['multiplier']
    return multiplier

async def get_quantity_precision(symbol, keys):

    client = Market(key=keys['api_key'], secret=keys['api_secret'], passphrase=keys['api_passphrase'], is_sandbox=False, url='')

    symbol = reformat_symbol(symbol)
        
    fetch = await client.get_contract_detail(symbol=symbol)
    multiplier = fetch['multiplier']
    min_qty = 1 * float(multiplier)
    precision = int(len(str(min_qty).split(".")[1])) if min_qty != 1 else 0
    return precision