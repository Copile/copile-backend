from .bingX.perpetual.v2.Perpetual import Perpetual
from ..firestore_functions import store_sl
import asyncio

async def send_stoploss(account_id, trade_id, sl_document_id, sl_number, sl_value, sl_percentage, sl_amount, trade_info, keys):
    symbol = trade_info["symbol"]
    side = trade_info["side"]

    client = Perpetual(api_key=keys["api_key"], api_secret=keys["api_secret"])

    precisions = client.contracts()
    for i in range(len(precisions)):
        if precisions[i]["symbol"] == symbol:
            quantityPrecision = precisions[i]["quantityPrecision"]
            pricePrecision = precisions[i]["pricePrecision"]

    position = client.positions(
        symbol=symbol,
    )
    quantity = position[0]["positionAmt"]
    
    if sl_amount == None:
        sl_amount = round(float(quantity) * float(sl_percentage), quantityPrecision)

    # Placing Stop-loss Limit Order
    try:
        sl_order = client.trade_order(
            symbol=symbol,
            type="STOP_MARKET",
            side="SELL" if side == "Buy" else "BUY",
            positionSide="SHORT" if side == "Sell" else "LONG",
            stopPrice=sl_value,
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
