import sqlite3

from pybit import HTTP

db_filename = '../../mira.db'

callid = 1
discord = 2
text = 3
order = 4


def bybit_cancel(side, symbol, API_KEY, API_SECRET):
    session = HTTP(
        endpoint='https://api.bybit.com',
        api_key=API_KEY,
        api_secret=API_SECRET
    )

    if str(session.my_position(symbol=symbol)['result'][0]['size']) != '0':
        quantity = int(session.my_position(symbol=symbol)['result'][0]['size'])
        try:
            stop = session.place_active_order(
                side='Buy' if side == 'Sell' else 'Sell',
                symbol=symbol,
                order_type="Market",
                qty=quantity,
                time_in_force="GoodTillCancel",
                reduce_only=True,
                close_on_trigger=False,
            )
            print(stop)
            return
        except Exception as error:
            print(error)
    elif str(session.my_position(symbol=symbol)['result'][0]['data'][0]['qty']) != '0':
        order_id = str(session.my_position(symbol=symbol)['result'][0]['data'][0]['order_id'])
        try:
            stop = session.cancel_active_order(
                symbol=symbol,
                order_id=order_id
            )
            print(stop)
            return
        except Exception as error:
            print(error)


def bybit_order(symbol, call_ID, name, API_KEY, API_SECRET, discord_ID):
    try:
        with sqlite3.connect(db_filename, check_same_thread=False) as database:
            cursor = database.cursor()
            for row in cursor.execute("SELECT * FROM orders"):
                if row[callid] == call_ID:
                    if row[discord] == discord_ID:
                        if row[text] == name:
                            session = HTTP(
                                endpoint='https://api.bybit.com',
                                api_key=API_KEY,
                                api_secret=API_SECRET
                            )
                            try:
                                cancel = session.cancel_active_order(
                                    symbol=symbol,
                                    order_id=str(row[order])
                                )
                                print(cancel)
                                sql_update = """DELETE from orders where orders_ID = ?"""
                                cursor.execute(sql_update, (int(row[0]),))
                                database.commit()
                                print("Cancelled order ID: " + str(row[order]))
                                return
                            except Exception as error:
                                print(f"{error} - {discord_ID}")
    except Exception as error:
        print("Data insertion failed {}".format(error))
    finally:
        cursor.close()
        database.close()


# export bybit_cancel and bybit_order
sys.modules[__name__] = bybit_cancel, bybit_order