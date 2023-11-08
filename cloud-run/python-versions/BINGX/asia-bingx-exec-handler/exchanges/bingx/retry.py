from .bingX.perpetual.v2.Perpetual import Perpetual
from ..firestore_functions import store_trade

async def retry_trade(account_id, payload, keys):
    try:
        trade_id = payload['tradeId']
        order_type = payload['type']
        symbol = payload['symbol']
        margin = payload['margin']
        leverage = payload['leverage']
        price = payload['price']
        side = payload['side']
        quantity = payload['quantity']

        client = Perpetual(api_key=keys["api_key"], api_secret=keys["api_secret"])

        create_order = await client.trade_order(
            symbol=symbol,
            type=order_type,
            price=price,
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
        print(error)