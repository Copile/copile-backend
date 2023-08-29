from .bingX.perpetual.v2.Perpetual import Perpetual
import asyncio

async def get_precision(account_id, symbol, keys):
    try:
        client = Perpetual(api_key=keys["api_key"], api_secret=keys["api_secret"])

        precisions = await client.contracts()
        precisions_dict = {precision["symbol"]: precision for precision in precisions}

        quantityPrecision = precisions_dict.get(symbol, {}).get("quantityPrecision")
        return quantityPrecision
    except Exception as error:
        print(error)