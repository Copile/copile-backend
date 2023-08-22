from .bingX.perpetual.v2.Perpetual import Perpetual
from ..firestore_functions import store_trade, get_user_margin
import asyncio

async def convert_symbol(symbol):
    index = symbol.find("USDT")
    if index != -1:
        converted_symbol = symbol[:index] + "-" + symbol[index:]
        return converted_symbol
    else:
        return symbol

async def get_precision(account_id, symbol, keys):

    client = Perpetual(api_key=keys["api_key"], api_secret=keys["api_secret"])

    precisions = client.contracts()
    for i in range(len(precisions)):
        if precisions[i]["symbol"] == symbol:
            precision = precisions[i]["quantityPrecision"]
    return precision