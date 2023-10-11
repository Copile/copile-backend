from .binlib.um_futures import UMFutures
from ..firestore_functions import store_trade
from .margin import get_user_margin
from .settings import get_market
import asyncio

async def send_trade(account_id, trade_id, margin, side, symbol, leverage, price, precision, keys):
    try:
        if type(margin) == str:
            margin = await get_user_margin(account_id, margin, keys)
            
        client = UMFutures(key=keys['api_key'], secret=keys['api_secret'])

        precision_dict = {item['symbol']: (item['pricePrecision'], item['quantityPrecision']) for item in precision if item['symbol'] == symbol}
        price_precision, quantity_precision = precision_dict[symbol]

        order_type = "LIMIT" if price != "market" else "MARKET"

        quantity = round((float(margin) * int(leverage) / float(price)), quantity_precision) if price != "market" else round((float(margin) * int(leverage) / float(await get_market(symbol, keys))), quantity_precision)

        create_order = await client.new_order(
            symbol=symbol,
            side=side.upper(),
            type=order_type,
            timeInForce='GTC' if price != "market" else None,
            quantity=quantity,
            price=round(float(price), price_precision) if price != "market" else None,
        )
        print(create_order)
        order_id = create_order['orderId']
        order_dict = {
            "trade_id": trade_id,
            "order_id": order_id,
            "symbol": symbol,
            "type": "LIMIT",
            "side": side,
            "quantity": quantity,
            "entry": price,
            "leverage": leverage,
            "margin": margin,
            "exchange": "binance"
        }
        await store_trade(account_id, order_dict)
        return order_dict
    except Exception as error:
        print(error)