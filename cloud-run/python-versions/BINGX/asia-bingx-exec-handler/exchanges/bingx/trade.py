from .bingX.perpetual.v2.Perpetual import Perpetual
from ..firestore_functions import store_trade
from .margin import get_user_margin
from .settings import get_market

async def send_trade(account_id, trade_id, margin, trader_id, side, symbol, leverage, price, precisions, keys):
    try:
        if type(margin) == str:
            margin = await get_user_margin(account_id, margin, trader_id, keys)

        client = Perpetual(api_key=keys["api_key"], api_secret=keys["api_secret"])

        side = "LONG" if side == "Buy" else "SHORT"

        precisions_dict = {precision["symbol"]: precision for precision in precisions}

        quantityPrecision = precisions_dict.get(symbol, {}).get("quantityPrecision")
        pricePrecision = precisions_dict.get(symbol, {}).get("pricePrecision")

        order_type = "LIMIT" if price != "market" else "MARKET"

        quantity = round((float(margin) * int(leverage) / float(price)), quantityPrecision) if price != "market" else round((float(margin) * int(leverage) / float(await get_market(symbol, keys))), quantityPrecision)
        
        create_order = await client.trade_order(
            symbol=symbol,
            type=order_type,
            price=round(float(price), pricePrecision) if price != "market" else None,
            side="SELL" if side == "SHORT" else "BUY",
            positionSide=side,
            quantity=quantity,
        )
        order_id = create_order["order"]["orderId"]
        order_dict = {
            "trade_id": trade_id,
            "order_id": order_id,
            "symbol": symbol,
            "type": order_type,
            "side": "Sell" if side == "SHORT" else "Buy",
            "quantity": quantity,
            "entry": price,
            "leverage": leverage,
            "margin": margin,
            "exchange": "bingx"
        }
        await store_trade(account_id, order_dict)
        return order_dict
    except Exception as error:
        raise Exception(f"Error submitting trade for {account_id}: {error}")
