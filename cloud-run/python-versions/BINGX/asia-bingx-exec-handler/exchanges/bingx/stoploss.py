from .bingX.perpetual.v2.Perpetual import Perpetual
from ..firestore_functions import store_sl
from .position import get_position
import asyncio

async def send_stoploss(account_id, trade_id, sl_document_id, sl_number, sl_value, sl_percentage, sl_amount, trade_info, precisions, keys):
    try:
        symbol = trade_info["symbol"]
        side = trade_info["side"]

        client = Perpetual(api_key=keys["api_key"], api_secret=keys["api_secret"])
        
        precisions_dict = {precision["symbol"]: precision for precision in precisions}
        quantityPrecision = precisions_dict.get(symbol, {}).get("quantityPrecision")
        pricePrecision = precisions_dict.get(symbol, {}).get("pricePrecision")

        if sl_amount is None:
            quantity = await get_position(account_id, trade_id, trade_info, keys)
            sl_amount = round(float(quantity) * float(sl_percentage), quantityPrecision)

        position = await client.positions(
            symbol=symbol,
        )
        positionSide = position[0]["positionSide"]

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
        await store_sl(account_id, sl_dict)
        return f"Successfully placed Stoploss {sl_value} Order for {account_id}"
    except Exception as error:
        print(error)