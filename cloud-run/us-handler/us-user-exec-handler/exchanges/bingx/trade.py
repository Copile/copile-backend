from .bingX.perpetual.v2.Perpetual import Perpetual
from ..firestore_functions import store_trade
from .margin import get_user_margin
import asyncio

async def convert_symbol(symbol):
    index = symbol.find("USDT")
    if index != -1:
        converted_symbol = symbol[:index] + "-" + symbol[index:]
        return converted_symbol
    else:
        return symbol


async def send_trade(account_id, trade_id, plan_id, side, symbol, leverage, price, keys):
    margin = await get_user_margin(account_id, plan_id, keys)    

    client = Perpetual(api_key=keys["api_key"], api_secret=keys["api_secret"])

    side = "LONG" if side == "Buy" else "SHORT"

    symbol = await convert_symbol(symbol)

    precisions = client.contracts()
    for i in range(len(precisions)):
        if precisions[i]["symbol"] == symbol:
            quantityPrecision = precisions[i]["quantityPrecision"]
            pricePrecision = precisions[i]["pricePrecision"]

    quantity = round((float(margin) * int(leverage) / float(price)), quantityPrecision)

    leverage_switch = client.switch_leverage(
        symbol=symbol,
        side=side,
        leverage=int(leverage),
    )

    try:
        mode = client.switch_margin_mode(
            symbol=symbol,
            marginType="ISOLATED"
        )
    except Exception:
        pass

    try:
        create_order = client.trade_order(
            symbol=symbol,
            type="LIMIT",
            price=round(float(price), pricePrecision),
            side="SELL" if side == "SHORT" else "BUY",
            positionSide=side,
            quantity=quantity,
        )
        order_id = create_order["order"]["orderId"]
        order_dict = {
            "trade_id": trade_id,
            "order_id": order_id,
            "symbol": symbol,
            "type": "LIMIT",
            "side": "Sell" if side == "SHORT" else "Buy",
            "quantity": quantity,
            "entry": price,
            "leverage": leverage,
            "margin": margin,
            "exchange": "bingx"
        }
        await store_trade(account_id, order_dict)
        return f"**Successfully placed order! - {account_id} - {order_id}**"
    except Exception as error:
        print(format(error))