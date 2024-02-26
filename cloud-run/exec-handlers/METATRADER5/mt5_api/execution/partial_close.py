from .api.perpetual import start_mt5, get_open_positions, close_position
from .utils.firestore import get_trade_info, update_trade_quantity
from .scripts.settings import get_precision


async def partial_close(login_id, password, server, data):
    try:
        # Create server connection to mt5
        start_mt5(login_id, password, server)

        trader_id = data['trader_id']
        account_id = data['acccount_id']
        trade_id = data['trade_id']
        percentage = data['percentage']

        trade_info = await get_trade_info(trader_id, account_id, trade_id)
        order_id = trade_info['orderID']

        # Filter open positions
        open_positions = get_open_positions()

        for pos in open_positions:
            if pos.ticket == order_id:
                symbol = pos.symbol
                precision = get_precision(symbol)
                quantity_precision = precision['quantity_precision']
                order_type = "SELL" if pos.type == 0 else "BUY"
                closing_volume = round(float(pos.volume) * float(percentage), quantity_precision)
                close_position(order_id, symbol, closing_volume, order_type, 0, "Copile Execution")
        await update_trade_quantity(trader_id, account_id, trade_id, round(float(pos.volume) - closing_volume), quantity_precision)

    except Exception as e:
        print(e)