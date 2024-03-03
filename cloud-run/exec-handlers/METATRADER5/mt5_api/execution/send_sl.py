from .api.connection import get_connection
from .utils.firestore import get_trade_info, store_sl
from .scripts.settings import get_precisions

async def send_sl(token, meta_id, data):
    try:
        connection = await get_connection(meta_id, token)
        terminal_state = connection.terminal_state
        
        trade_id = data['trade_id']
        trader_id = data['trader_id']
        
        document_id = data['document_id']
        payload = data['payload']

        # Fetching the trade info from firestore
        trade_info = await get_trade_info(trader_id, meta_id, trade_id)
        order_id = str(trade_info['orderID'])

        precision = get_precisions(terminal_state, trade_info['symbol'])
        price_precision = precision['price_precision']

        stop_loss_price = round(float(payload['sl_value']), price_precision)

        open_positions = terminal_state.positions

        position_status = False

        for position in open_positions:
            if position['id'] == order_id:

                if 'takeProfit' not in position:
                    position['takeProfit'] = None

                await connection.modify_position(order_id, stop_loss_price, position['takeProfit'])
                position_status = True

        if position_status == False:
            open_orders = terminal_state.orders

            for order in open_orders:

                if order['id'] == order_id:

                    if 'takeProfit' not in order:
                        order['takeProfit'] = None

                    await connection.modify_order(order_id, float(order['openPrice']), stop_loss_price, order['takeProfit'])
        
        payload['trade_id'] = trade_id
        payload['sl_amount'] = 1
        payload['order_id'] = order_id
        payload['sl_document_id'] = document_id

        await store_sl(trader_id, meta_id, payload) 
        await connection.close()
        return
    except Exception as e:
        print(e)
