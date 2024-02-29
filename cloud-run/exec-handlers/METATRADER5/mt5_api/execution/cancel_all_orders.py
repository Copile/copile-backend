from .api.connection import get_connection
from .api.position import get_position_status
from .utils.firestore import get_trade_info

async def cancel_all_orders(token, meta_id, data):
    try:
        connection = await get_connection(meta_id, token)
        terminal_state = connection.terminal_state

        trader_id = data['trader_id']
        trade_id = data['trade_id']

        trade_info = await get_trade_info(trader_id, meta_id, trade_id)
        order_id = trade_info['orderID']

        position_status = await get_position_status(order_id, terminal_state)

        if position_status == True:
            await connection.close_position(order_id)
        else:
            await connection.cancel_order(order_id)

    except Exception as e:
        print(e)
