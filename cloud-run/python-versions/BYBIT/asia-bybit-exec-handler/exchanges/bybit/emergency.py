from .pybit.unified_trading import HTTP
from .clear import clear_orders

async def send_emergency(account_id, trade_id, trade_info, keys):
    try:
        symbol = trade_info["symbol"]
        side = trade_info["side"]
        order_id = trade_info["orderID"]
        
        # Connecting to Bybit API
        session = HTTP(
            testnet=False,
            api_key=keys["api_key"],
            api_secret=keys["api_secret"],
        )

        fetch = await session.get_positions(category="linear", symbol=symbol)
        position = fetch['result']['list'][0]['size']
        if float(position) != 0:
                stop = await session.place_order(
                    category="linear",
                    side='Buy' if side == 'Sell' else 'Sell',
                    symbol=symbol,
                    orderType="Market",
                    qty=float(position),
                    timeInForce="GTC",
                    reduceOnly=True,
                    closeOnTrigger=False,
                )
                await clear_orders(account_id, trade_id, trade_info, keys)
                return
        else:
            stop = await session.cancel_order(
                category="linear",
                symbol=symbol,
                orderId=order_id
            )
            await clear_orders(account_id, trade_id, trade_info, keys)
            return
    except Exception as error:
        print(error)