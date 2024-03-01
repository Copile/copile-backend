from .api.connection import get_connection
from .utils.firestore import get_trade_info, store_tp
from .scripts.settings import get_precisions

async def send_tp(token, meta_id, data):
    try:
        connection = await get_connection(meta_id, token)
        terminal_state = connection.terminal_state
        
        trade_id = data['trade_id']
        trader_id = data['trader_id']
        
        document_id = data['tp_id']
        payload = data['payload']

        # Fetching the trade info from firestore
        trade_info = await get_trade_info(trader_id, meta_id, trade_id)
        order_id = str(trade_info['orderID'])

        precision = get_precisions(terminal_state, trade_info['symbol'])
        price_precision = precision['price_precision']

        take_profit_price = round(float(payload['tp_value']), price_precision)

        open_positions = terminal_state.positions

        position_status = False

        for position in open_positions:
            if position['id'] == order_id:

                if 'stopLoss' not in position:
                    position['stopLoss'] = None

                await connection.modify_position(order_id, position['stopLoss'], take_profit_price)
                position_status = True

        if position_status == False:
            open_orders = terminal_state.orders

            for order in open_orders:

                if order['id'] == order_id:

                    if 'stopLoss' not in order:
                        order['stopLoss'] = None

                    await connection.modify_order(order_id, float(order['openPrice']), order['stopLoss'], take_profit_price)
        
        payload['trade_id'] = trade_id
        payload['tp_amount'] = 1
        payload['order_id'] = order_id
        payload['tp_document_id'] = document_id

        await store_tp(trader_id, meta_id, payload) 

    except Exception as e:
        print(e)
