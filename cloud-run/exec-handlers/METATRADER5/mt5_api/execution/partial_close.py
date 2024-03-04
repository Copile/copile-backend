from .api.connection import get_connection
from .scripts.settings import get_precisions
from .utils.firestore import get_trade_info, update_trade_quantity_margin

async def partial_close(token, meta_id, data):
    try:
        connection = await get_connection(meta_id, token)
        terminal_state = connection.terminal_state

        trader_id = data['trader_id']
        trade_id = data['trade_id']
        percentage = data['percentage']

        trade_info = await get_trade_info(trader_id, meta_id, trade_id)
        order_id = trade_info['orderID']
        margin = float(trade_info['margin'])

        new_margin = round(margin * (1 - percentage), 2)

        precision = get_precisions(terminal_state, trade_info['symbol'])
        quantity_precision = precision['quantity_precision']

        open_positions = terminal_state.positions

        for position in open_positions:
            if position['id'] == order_id:
                current_quantity = float(position['volume'])
                sell_quantity = round(current_quantity * percentage, quantity_precision)
                await connection.close_position_partially(order_id, sell_quantity)

        await update_trade_quantity_margin(trader_id, meta_id, trade_id, round(current_quantity - sell_quantity, quantity_precision), new_margin)
        await connection.close()
        return
    except Exception as e:
        print(e)
