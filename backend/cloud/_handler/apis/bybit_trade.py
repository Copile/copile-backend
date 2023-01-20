import sqlite3
import time

from pybit import HTTP

db_filename = '../../mira.db'


def bybit(side, symbol, leverage, Margin, price, API_KEY, API_SECRET, member):
    side = "Buy" if side == "BUY" else "Sell"

    # Connecting to Bybit API
    session = HTTP(
        endpoint='https://api.bybit.com',
        api_key=API_KEY,
        api_secret=API_SECRET
    )
    min_qty = session.query_symbol(symbol=symbol)['result']
    for item in min_qty:
        if item['name'] == symbol:
            p = len(str(item['lot_size_filter']['min_trading_qty']).split(".")[1])
            precision = int(p)
    quantity = round((float(Margin) * int(leverage) / float(price)), precision)
    # Changing leverage or Margin mode to Isolated/Cross
    try:
        leverage = session.set_leverage(
            symbol=symbol,
            buy_leverage=int(leverage),
            sell_leverage=int(leverage)
        )
    except Exception as error:
        print(f"Leverage set - {member}")
    try:
        mode = session.cross_isolated_margin_switch(
            symbol=symbol,
            is_isolated=False,
        )
    except Exception as error:
        print(f"Switched to Cross-Margin - {member}")

    # Creating order and placing all necessary Take profit positions
    try:
        create_order = session.place_active_order(
            side=side,
            symbol=symbol,
            order_type="Limit",
            price=price,
            qty=quantity,
            time_in_force="GoodTillCancel",
            reduce_only=False,
            close_on_trigger=False,
        )
        print(f"**Successfully placed order! - {member}**")
        return
    except Exception as error:
        print(format(error))


def bybit_profit(side, symbol, leverage, Margin, price, TPS, API_KEY, API_SECRET, call_ID, discord_ID):
    side = 'BUY' if side == 'Buy' else 'SELL'

    # Connecting to Bybit API
    session = HTTP(
        endpoint='https://api.bybit.com',
        api_key=API_KEY,
        api_secret=API_SECRET
    )
    precision = int(session.query_symbol(symbol=symbol)['result'][0]['price_scale'])
    quantity = round((float(Margin) * int(leverage) / float(price)), precision)
    while True:
        time.sleep(2)
        if str(session.my_position(symbol=symbol)['result'][0]['size']) != '0':
            print(str(session.my_position(symbol=symbol)['result'][0]['size']))
            side1 = 'Sell' if side == 'BUY' else 'Buy'
            orders = [{
                'symbol': symbol,
                'order_type': 'Limit',
                'side': side1,
                'qty': round(quantity / int(len(TPS)), precision),
                'price': i,
                'time_in_force': 'GoodTillCancel',
                'reduce_only': True,
                'close_on_trigger': True,
            } for i in TPS]
            TPS_orders = session.place_active_order_bulk(orders)
            TPS_order = []
            try:
                with sqlite3.connect(db_filename, check_same_thread=False) as database:
                    cursor = database.cursor()
                    for i in range(len(TPS)):
                        TPS_order.append(TPS_orders[i]['result']['order_id'])
                        data = [call_ID, discord_ID, f"TP {i}", TPS_orders[i]['result']['order_id']]
                        sql_insert_query = '''INSERT INTO orders(call_ID,discord_ID,type,order) VALUES(?,?,?,?)'''
                        cursor.execute(sql_insert_query, data)
                        database.commit()
                        print("Sent TP-Order ID: " + TPS_orders[i]['result']['order_id'])
            except Exception as error:
                print("Data insertion failed {}".format(error))
            finally:
                cursor.close()
                database.close()


def bybit_stoploss(side, symbol, leverage, Margin, price, stoploss, API_KEY, API_SECRET, call_ID, discord_ID):
    side = 'BUY' if side == 'Buy' else 'SELL'

    # Connecting to Bybit API
    session = HTTP(
        endpoint='https://api.bybit.com',
        api_key=API_KEY,
        api_secret=API_SECRET
    )
    precision = int(session.query_symbol(symbol=symbol)['result'][0]['price_scale'])
    quantity = round((float(Margin) * int(leverage) / float(price)), precision)

    while True:
        time.sleep(2)
        if str(session.my_position(symbol=symbol)['result'][0]['size']) != '0':
            print(str(session.my_position(symbol=symbol)['result'][0]['size']))
            side1 = 'Sell' if side == 'BUY' else 'Buy'
            loss = session.cancel_active_order(
                symbol=symbol,
                order_type='Limit',
                side=side1,
                qty=round(quantity, precision),
                price=stoploss,
                time_in_force='GoodTillCancel',
                reduce_only=True,
                close_on_trigger=True,
            )
            try:
                with sqlite3.connect(db_filename, check_same_thread=False) as database:
                    cursor = database.cursor()
                    order_id = (loss['result']['order_id'])
                    data = [call_ID, discord_ID, f"SL", order_id]
                    sql_insert_query = '''INSERT INTO orders(call_ID,discord_ID,type,order) VALUES(?,?,?,?)'''
                    cursor.execute(sql_insert_query, data)
                    database.commit()
                    print("Sent SL-Order ID: " + order_id)
            except Exception as error:
                print("Data insertion failed {}".format(error))
            finally:
                cursor.close()
                database.close()


# export bypit bybit_profit bybit_stoploss
sys.modules[__name__] = bybit, bybit_profit, bybit_stoploss