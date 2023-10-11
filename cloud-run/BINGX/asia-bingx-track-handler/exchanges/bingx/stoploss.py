from .bingX.perpetual.v2.Perpetual import Perpetual
from ..firestore_functions import store_sl_exec
from .position import get_position
import asyncio
import time

async def send_stoploss(account_id, trade_id, sl_document_id, sl_number, sl_value, sl_percentage, sl_amount, position, trade_info, precisions, keys):
    max_retries = 3
    retry_count = 0
    while retry_count < max_retries:
        try:
            await stoploss_order(account_id, trade_id, sl_document_id, sl_number, sl_value, sl_percentage, sl_amount, position, trade_info, precisions, keys)
            return f"Successfully placed Stoploss {sl_value} Order for {account_id}"
        except Exception as error:
            print(f"Error occurred: {error}")
            retry_count += 1
            time.sleep(5)
    return "Failed to place Stoploss order after multiple retries"

async def stoploss_order(account_id, trade_id, sl_document_id, sl_number, sl_value, sl_percentage, sl_amount, position, trade_info, precisions, keys):
    try:    
        symbol = trade_info["symbol"]
        side = trade_info["side"]

        client = Perpetual(api_key=keys["api_key"], api_secret=keys["api_secret"])

        precisions_dict = {precision["symbol"]: precision for precision in precisions}
        quantityPrecision = precisions_dict.get(symbol, {}).get("quantityPrecision")
        pricePrecision = precisions_dict.get(symbol, {}).get("pricePrecision")

        position = await client.positions(
            symbol=symbol,
        )
        positionSide = position[0]["positionSide"]

        if sl_amount is None:
            quantity = abs(float(position[0]['positionAmt']))
            sl_amount = round(float(quantity) * float(sl_percentage), quantityPrecision)

        # Placing Stop-loss Limit Order
        sl_order = await client.trade_order(
            symbol=symbol,
            type="STOP_MARKET",
            side="SELL" if side == "Buy" else "BUY",
            positionSide=positionSide,
            stopPrice=round(float(sl_value), pricePrecision),
            quantity=sl_amount
        )
        order_id = sl_order["order"]['orderId']
        sl_dict = {
            "order_id": order_id,
            "trade_id": trade_id,
            "sl_document_id": sl_document_id,
            "sl_number": sl_number,
            "sl_value": sl_value,
            "sl_percentage": sl_percentage,
            "sl_amount": sl_amount
        }
        await store_sl_exec(account_id, sl_dict)
        return f"Successfully placed Stoploss {sl_value} Order for {account_id}"
    except Exception as error:
        print(error)
