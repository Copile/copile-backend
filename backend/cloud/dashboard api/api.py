import sqlite3

from binance.client import Client
from flask import Flask
from flask_restful import Resource, Api, reqparse
from pybit import HTTP
from backend.sender.Sender.sender import start, take_profits, send_cancel, cancel_order, stop_loss

app = Flask("Mira")
api = Api(app)
db_filename = '../mira.db'


# method that receives api_key, api_secret, exchange and member and sets up a test connection
class test_connection(Resource):
    @staticmethod
    def post():
        params = {'api_key', 'api_secret', 'exchange', 'member'}
        args = create_parser(params).parse_args()

        if args['exchange'] == 'bybit':
            try:
                session = HTTP(
                    endpoint='https://api.bybit.com',
                    api_key=args['api_key'],
                    api_secret=args['api_secret']
                )
                test = session.get_wallet_balance()
                return {
                           'message': f"{args}, valid"}, 200
            except Exception as e:
                return {
                           'message': f"{e}, invalid"}, 422
        if args['exchange'] == 'binance':
            try:
                client = Client(args['api_key'], args['api_secret'])
                test = client.futures_account_balance()
                return {
                           'message': f"{args}, valid"}, 200
            except Exception as e:
                return {
                           'message': f"{e}, invalid"}, 422


# receives member data and stores into database table 'members'
class user_data(Resource):
    @staticmethod
    def post():
        parser = reqparse.RequestParser()
        parser.add_argument('discord_id', required=False)
        parser.add_argument('exchange_1', required=False)
        parser.add_argument('apiKey_1', required=False)
        parser.add_argument('secretKey_1', required=False)
        parser.add_argument('exchange_2', required=False)
        parser.add_argument('apiKey_2', required=False)
        parser.add_argument('secretKey_2', required=False)
        parser.add_argument('risk', required=False)
        parser.add_argument('current_exchange', required=False)
        args = parser.parse_args()
        try:
            data = (args['discord_id'], args['exchange_1'], args['apiKey_1'], args['secretKey_1'], args['exchange_2'],
                    args['apiKey_2'],
                    args['secretKey_2'], args['risk'], args['current_exchange'])
            user_data.handle_userdata(data)
        except Exception as error:
            print(error)

    @staticmethod
    # stores or updates user data into database table 'members'
    def handle_userdata(data):
        try:
            with sqlite3.connect(db_filename, check_same_thread=False) as database:
                cursor = database.cursor()
                response = cursor.execute("SELECT * FROM members")
                column_names = list(map(lambda x: x[0], response.description))
                # if the user doesn't exist, create a new user in database
                if not user_data.get_user_data(data[0]):
                    sql_insert_query = '''INSERT INTO members(discord_id,exchange_1,apiKey_1,secretKey_1,exchange_2,apiKey_2,
                                       secretKey_2, risk, current_exchange) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) '''
                    cursor.execute(sql_insert_query, data)
                    print("User data successfully stored in database")
                # if user exists, updates current user
                else:
                    i = 0
                    for row in data:
                        # checks if the parameter has been passed, if not, it will not update the database
                        if row is not None and column_names[i] != 'discord_id':
                            cursor.execute("UPDATE members SET " + column_names[i] + "= ? WHERE discord_id = ?",
                                           (row, data[0]))
                        i = i + 1
                    print("User data successfully updated")
            database.commit()
            return True
        except Exception as error:
            print("(handle_userdata) Data insertion failed {}".format(error))
            return False
        finally:
            cursor.close()
            database.close()

    @staticmethod
    # gets userdata with passed discord_id
    def get_user_data(discord_id):
        try:
            with sqlite3.connect(db_filename, check_same_thread=False) as database:
                cursor = database.cursor()
                # prepared statement
                sql_select_query = '''SELECT * FROM members WHERE discord_id = ?'''
                # data to insert
                response = cursor.execute(sql_select_query, (discord_id,)).fetchone()
                if response is not None:
                    print("User data found")
                    return response
                else:
                    print("User data not found")
                    return False
        except Exception as error:
            print("(get_user_data) Query failed {}".format(error))
            return False
        finally:
            cursor.close()
            database.close()


# connects to exchange and gets open trades
class trades(Resource):
    @staticmethod
    def get():
        try:
            discord_id = 1313123133123
            coins = trades.get_current_calls()
            current_exchange = get_current_exchange(discord_id)
            session = connect_exchange(discord_id)  # <- discord_id value,currently  test
            return globals()[str(current_exchange).lower() + "_get_open_trades"](coins, session)
        except Exception as error:
            print("(trades) Globals method call failed {}".format(error))

    # fetches open trades
    @staticmethod
    def get_current_calls():
        try:
            with sqlite3.connect(db_filename, check_same_thread=False) as database:
                cursor = database.cursor()
                cursor.execute("SELECT coin FROM calls")
                print("Successfully fetched Coins")
                coins = cursor.fetchall()
                return coins
        except Exception as error:
            print("(get_current_calls) Query failed {}".format(error))
            return False
        finally:
            cursor.close()
            database.close()


def bybit_get_open_trades(coins, session):
    data = []
    data.clear()
    for coin in coins:
        if coin != "":
            response = session.my_position(symbol=coin[0])['result']
            for entry in response:
                if entry['size'] != 0:
                    data.append(entry['symbol'])  # symbol
                    data.append(entry['size'])  # quantity
                    data.append(entry['entry_price'])  # entry price
                    data.append(entry['position_value'])  # value in USDT
                    data.append(entry['liq_price'])  # liquidation price
                    data.append(entry['position_margin'])  # position margin
                    data.append(entry['unrealised_pnl'])  # unrealized P&L
                    data.append(entry['realised_pnl'])  # today's realized P&L
    return data


def binance_get_open_trades(coins, session):
    data = []
    data.clear()
    for coin in coins:
        if coin != "":
            response = session.futures_position_information(symbol=coin[0])
            for entry in response:
                if entry['notional'] != '0':
                    data.append(entry['symbol'])  # symbol
                    data.append(entry['positionAmt'])  # quantity
                    data.append(entry['entryPrice'])  # entry price
                    data.append(entry['notional'])  # value in USDT
                    data.append(entry['liquidationPrice'])  # liquidation price
                    data.append(entry['isolatedMargin'])  # margin
                    data.append(entry['unRealizedProfit'])  # unrealized P&L
    return data


# method that fetches Client's USDT Balance
class balances(Resource):
    @staticmethod
    def get():
        try:
            discord_id = 1313123133123
            data = []
            data.clear()
            current_exchange = get_current_exchange(discord_id)
            session = connect_exchange(discord_id)  # <- discord_id value
            return globals()[str(current_exchange).lower() + "_get_current_balances"](session)
        except Exception as error:
            print("(balances) Globals method call failed {}".format(error))


def binance_get_current_balance(session):
    data = []
    data.clear()
    response = str(session.futures_account())
    data.append(response[
                (response.index("totalWalletBalance") + 22): (response.index("totalUnrealizedProfit") - 4)])
    data.append(response[
                (response.index("totalUnrealizedProfit") + 25): (response.index("totalMarginBalance") - 4)])
    return data


def bybit_get_current_balances(session):
    data = []
    data.clear()
    response = str(session.get_wallet_balance(coin="USDT")['result'])
    data.append(response[(response.index("equity") + 9):response.index(',')])  # user equity
    data.append(response[(response.index("realised_pnl") + 15):(
            response.index('unrealised_pnl') - 3)])  # today's realised P&L
    data.append(response[(response.index("unrealised_pnl") + 17):(
            response.index('cum_realised_pnl') - 3)])  # unrealised P&L
    data.append(response[(response.index("cum_realised_pnl") + 19):(
            response.index('given_cash') - 3)])  # Total all-time P&L
    return data


# method that fetches keys of exchange that is passed
def get_keys(discord_id, exchange):
    try:
        with sqlite3.connect(db_filename, check_same_thread=False) as database:
            cursor = database.cursor()
            # get exchange_1 and exchange_2
            exchanges = cursor.execute(
                "SELECT exchange_1,exchange_2 FROM members WHERE discord_id = " + str(discord_id)).fetchone()

            # if passed exchanged equals to exchange_1, get apiKey_1 and secretKey_1
            # if it equals to exchange 2, get apiKey_2 and secretKey_2
            keys = cursor.execute("SELECT apiKey_1, secretKey_1 FROM members WHERE discord_id = " + str(
                discord_id)).fetchone() if exchange == exchanges[0] else cursor.execute(
                "SELECT apiKey_2, secretKey_2 FROM members WHERE discord_id = " + str(discord_id)).fetchone()

            print("Successfully fetched keys")
            return keys
    except Exception as error:
        print("(get_keys) Query failed {}".format(error))
        return False
    finally:
        cursor.close()
        database.close()


# returns the currently selected exchange, if none is selected defaults to exchange_1
def get_current_exchange(discord_id):
    try:
        with sqlite3.connect(db_filename, check_same_thread=False) as database:
            cursor = database.cursor()
            exchange = cursor.execute("SELECT current_exchange FROM members WHERE discord_id = ?",
                                      (discord_id,)).fetchone()
            print("Successfully fetched current exchange")
            if exchange == "":
                exchange = cursor.execute("SELECT exchange_1 FROM members WHERE discord_id = ?",
                                          (discord_id,)).fetchone()
            return exchange[0]
    except Exception as error:
        print("(get_current_exchange) Query failed {}".format(error))
        return False
    finally:
        cursor.close()
        database.close()


# finds currently selected exchange, fetches its keys and setups the connection
def connect_exchange(discord_id):
    try:
        # get the currently selected exchange
        exchange = get_current_exchange(discord_id)
        # get the keys of user on currently selected exchange
        keys = get_keys(discord_id, exchange)
        # setup connection and return it
        return globals()[str(exchange).lower() + "_connect"](keys)
    except Exception as error:
        print("(connect_exchange) Globals method call failed {}".format(error))
        return False


# returns a connection to binance exchange
def binance_connect(keys):
    return Client(keys[0], keys[1])


# returns a connection to bybit exchangeb
def bybit_connect(keys):
    return HTTP("https://api.bybit.com",
                api_key=keys[0], api_secret=keys[1])


#######################################################################################################################
# ADMIN DASH
# send calls
class send_call(Resource):
    @staticmethod
    def post():
        params = {'side', 'symbol', 'leverage', 'price'}
        args = create_parser(params).parse_args()
        try:
            start(args['side'], args['symbol'], args['leverage'], args['price'])
        except Exception as error:
            print(error)


# send take profits
class send_takeprofit(Resource):
    @staticmethod
    def post():
        params = {'coin', 'entry', 'leverage', 'date', 'tps', 'call_id'}
        args = create_parser(params).parse_args()
        try:
            take_profits(args['coin'], args['entry'], args['leverage'], args['date'], args['tps'], args['call_id'])
        except Exception as error:
            print(error)


# cancel a specific order
class cancel_single_order(Resource):
    @staticmethod
    def post():
        params = {'symbol', 'call_id', 'name'}
        args = create_parser(params).parse_args()
        try:
            cancel_order(args['symbol'], args['call_id'], args['name'])
        except Exception as error:
            print(error)


# cancels all orders
class cancel_all_orders(Resource):
    @staticmethod
    def post():
        params = {'symbol', 'call_id'}
        args = create_parser(params).parse_args()
        try:
            send_cancel(args['symbol'], args['call_id'])
        except Exception as error:
            print(error)


# send stop loss order
class send_stoploss(Resource):
    @staticmethod
    def post():
        params = {'side', 'symbol', 'leverage', 'price', 'stoploss', 'call_id'}
        args = create_parser(params).parse_args()
        try:
            stop_loss(args['side'], args['symbol'], args['leverage'], args['price'], args['stoploss'],
                      args['call_id'])
        except Exception as error:
            print(error)


# createParser for code reduction, rn only required=True works
def create_parser(params):
    parser = reqparse.RequestParser()
    for param in params:
        parser.add_argument(param, required=True)
    return parser


api.add_resource(test_connection, '/test_connection')
api.add_resource(user_data, '/user_data')
api.add_resource(trades, '/trades')
api.add_resource(balances, '/balances')

api.add_resource(send_call, '/send_call')
api.add_resource(send_takeprofit, '/send_takeprofit')
api.add_resource(cancel_single_order, '/cancel_single_order')
api.add_resource(cancel_all_orders, '/cancel_all_orders')
api.add_resource(send_stoploss, '/send_stoploss')

app.run()
