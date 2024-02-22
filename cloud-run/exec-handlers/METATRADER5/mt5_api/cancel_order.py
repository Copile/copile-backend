from api.perpetual import start_mt5, modify_position
from utils.firestore import get_trade_info, store_sl

async def cancel_order(login_id, password, server, data):
    try:
        # Create server connection to mt5
        start_mt5(login_id, password, server)

        trade_id = data['trade_id']
        account_id = data['account_id']
        trader_id = data['trader_id']
    
        document_id = data['document_id']
        trade_type = data['trade_type']

        trade_info = await get_trade_info(trader_id, account_id, trade_id)
        order_id = trade_info['orderID']
        symbol = trade_info['symbol']

        modification = modify_position(order_id, symbol, None if trade_type != "tp" else 0, None if trade_type != "sl" else 0)

        if modification == True:
            print("Good")

    except Exception as e:
        print(e)
