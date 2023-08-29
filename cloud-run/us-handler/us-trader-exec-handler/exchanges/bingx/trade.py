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


async def send_trade(account_id, trade_id, margin, side, symbol, leverage, price, keys):
    try:
        client = Perpetual(api_key=keys["api_key"], api_secret=keys["api_secret"])

        side = "LONG" if side == "Buy" else "SHORT"

        symbol = await convert_symbol(symbol)

        leverage_switch, precisions = await asyncio.gather(
            client.switch_leverage(symbol=symbol, side=side, leverage=int(leverage)),
            client.contracts()
        )

        precisions_dict = {precision["symbol"]: precision for precision in precisions}

        quantityPrecision = precisions_dict.get(symbol, {}).get("quantityPrecision")
        pricePrecision = precisions_dict.get(symbol, {}).get("pricePrecision")

        quantity = round((float(margin) * int(leverage) / float(price)), quantityPrecision)

        try:
            mode = await client.switch_margin_mode(
                symbol=symbol,
                marginType="ISOLATED"
            )
        except Exception:
            pass

        create_order = await client.trade_order(
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
        print(error)        
