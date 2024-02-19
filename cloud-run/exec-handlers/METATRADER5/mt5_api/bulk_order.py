import time
import asyncio
import MetaTrader5 as mt5
from api.perpetual import place_order, start_mt5

async def bulk_order(login_id, password, server, data):
    try:
        # Create server connection to mt5
        start_mt5(login_id, password, server)

        trade_id = data['trade_id']
        account_id = data['account_id']
        trader_id = data['trader_id']
        
        side = data['payload']['side'].upper()
        leverage = data['payload']['leverage']
        entry = data['payload']['entry']
        stop_losses = data['payload']['stop_losses']
        take_profits = data['payload']['take_profits']

        

        # Creating logger for info/errors
        #logger = Logger(user_id, trade_id)

        #logger.info(f"Starting bulk order with data: {data}")
        #print(mt5.account_info())
        
        symbol = "BTCUSD"
        point = mt5.symbol_info(symbol).point
        print(point)
        order = {'symbol': symbol, 'volume': 0.01, 'sl': float(49000), 'type_time': 0, 
                 'comment': 'python Script', 'type': mt5.ORDER_TYPE_BUY, 
                 'action': mt5.TRADE_ACTION_DEAL, 'type_filling': mt5.ORDER_FILLING_FOK}
        #print(mt5.order_send(order))
        print(mt5.account_info())
        #order_type, symbol, volume, stop_loss, take_profit, comment, direct=False, price=0
        #initial_order = place_order("BUY", "BTCUSD", 0.01, 50000, 55000, "python Script", False)

        mt5.shutdown()

    except Exception as e:
        print(e)

asyncio.run(bulk_order(48116, "3Aq^[^^!X£D1Qa3jd", "EvolveMarkets-MT5 Demo Server", "nothing"))