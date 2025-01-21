from .api.connection import get_connection
from .utils.firestore import get_trade_info, update_tp_sl_price

async def cancel_order(token, meta_id, data):
    try:
        connection = await get_connection(meta_id, token)

        trade_id = data['trade_id']
        trader_id = data['trader_id']
        
        trade_type = data['trade_type']

        # Fetching the trade info from firestore
        trade_info = await get_trade_info(trader_id, meta_id, trade_id)
        order_id = str(trade_info['orderID'])

        terminal_state = connection.terminal_state

        open_positions = terminal_state.positions

        position_status = False

        for position in open_positions:
            if position['id'] == order_id:

                if 'takeProfit' not in position:
                    position['takeProfit'] = None

                if 'stopLoss' not in position:
                    position['stopLoss'] = None

                stop_loss = None if trade_type == 'sl' else position['stopLoss']
                take_profit = None if trade_type == 'tp' else position['takeProfit']

                await connection.modify_position(order_id, stop_loss, take_profit)
                position_status = True

        if position_status == False:
            open_orders = terminal_state.orders

            for order in open_orders:

                if order['id'] == order_id:

                    if 'takeProfit' not in order:
                        position['takeProfit'] = None

                    if 'stopLoss' not in order:
                        position['stopLoss'] = None

                    stop_loss = None if trade_type == 'sl' else order['stopLoss']
                    take_profit = None if trade_type == 'tp' else order['takeProfit']

                    await connection.modify_order(order_id, float(order['openPrice']), stop_loss, take_profit)
        await update_tp_sl_price(trader_id, meta_id, trade_id, None, trade_type)
        await connection.close()
        return
    except Exception as e:
        print(e)
