from .binlib.um_futures import UMFutures
from ..firestore_functions import store_trade, get_user_margin
import asyncio

async def send_trade(account_id, trade_id, margin, side, symbol, leverage, price, keys):
    client = UMFutures(key=keys['api_key'], secret=keys['api_secret'])

    try:
        margin_type = await client.change_margin_type(symbol=symbol, marginType="ISOLATED")   
    except Exception as error:
        pass

    leverage_change, symbol_info = await asyncio.gather(
            client.change_leverage(symbol=symbol, leverage=int(leverage)),
            client.exchange_info(),
    )
    symbols = symbol_info['symbols']

    for i in range(len(symbols)):
        if symbols[i]['symbol'] == symbol:
            pricePrecision = symbols[i]['pricePrecision']
            quantityPrecision = symbols[i]['quantityPrecision']

    quantity = round((float(margin) * int(leverage) / float(price)), quantityPrecision)

    create_order = await client.new_order(
        symbol=symbol,
        side=side.upper(),
        type='LIMIT',
        timeInForce='GTC',
        quantity=quantity,
        price=round(float(price), pricePrecision),
    )
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
    return f"**Successfully placed order! - User: {account_id} - {symbol} - Order ID: {order_id}**"