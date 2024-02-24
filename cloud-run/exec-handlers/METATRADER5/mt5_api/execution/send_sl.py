from api.perpetual import start_mt5, modify_position
from utils.firestore import get_trade_info, store_sl

async def send_sl(login_id, password, server, data):
    try:
        start_mt5(login_id, password, server)

        trade_id = data['trade_id']
        account_id = data['account_id']
        trader_id = data['trader_id']
        
        document_id = data['sl_id']
        payload = data['payload']

        # Fetching the trade info from firestore
        trade_info = await get_trade_info(account_id, trade_id)
        trade_info = {}
        symbol = trade_info['symbol']
        order_id = trade_info['orderID']
        
        modification = modify_position(order_id, symbol, payload['sl_value'], None)

        if modification == True:
            payload['trade_id'] = trade_id
            payload['sl_amount'] = 1
            payload['order_id'] = order_id
            payload['sl_document_id'] = document_id

            await store_sl(trader_id, account_id, payload) 
    except Exception as e:
        print(e)