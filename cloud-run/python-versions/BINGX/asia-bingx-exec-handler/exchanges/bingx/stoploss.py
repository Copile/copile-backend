from .bingX.perpetual.v2.Perpetual import Perpetual
from ..firestore_functions import store_sl
from .position import get_position

async def send_stoploss(account_id, trade_id, sl_document_id, sl_number, sl_value, sl_percentage, sl_amount, trade_info, precisions, keys):
    try:
        symbol = trade_info["symbol"]
        side = trade_info["side"]

        client = Perpetual(api_key=keys["api_key"], api_secret=keys["api_secret"])
        
        precisions_dict = {precision["symbol"]: precision for precision in precisions}
        quantityPrecision = precisions_dict.get(symbol, {}).get("quantityPrecision")
        pricePrecision = precisions_dict.get(symbol, {}).get("pricePrecision")

        if sl_amount is None:
            position_quantity = await get_position(account_id, trade_id, trade_info, keys)
            quantity = trade_info["quantity"] if await get_position(account_id, trade_id, trade_info, keys) == 0 else position_quantity 
            sl_amount = round(float(quantity) * float(sl_percentage), quantityPrecision)

        # Placing Stop-loss Limit Order
        sl_order = await client.trade_order(
            symbol=symbol,
            type="TRIGGER_MARKET",
            side="SELL" if side == "Buy" else "BUY",
            positionSide="SHORT" if side == "Sell" else "LONG",
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
       raise Exception(f"Error submitting stoploss for {account_id}: {error}")