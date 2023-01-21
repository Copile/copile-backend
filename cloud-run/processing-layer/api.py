from flask import Flask
from flask_restful import Resource, Api, reqparse

app = Flask("Mira")
api = Api(app)

# send calls
class send_call(Resource):
    @staticmethod
    def post():
        #params = {'side', 'symbol', 'leverage', 'price'}
        #args = create_parser(params).parse_args()
        try:
            #call method to start trade
        except Exception as error:
            print(error)


# send take profit
class send_tp(Resource):
    @staticmethod
    def post():
        #params = {'coin', 'entry', 'leverage', 'date', 'tps', 'call_id'}
        #args = create_parser(params).parse_args()
        try:
            #call method to sent tp
        except Exception as error:
            print(error)


# cancel a specific order
class cancel_order(Resource):
    @staticmethod
    def post():
        #params = {'symbol', 'call_id', 'name'}
        #args = create_parser(params).parse_args()
        try:
            #call method to cancel one order
        except Exception as error:
            print(error)


# cancels all orders
class cancel_all_orders(Resource):
    @staticmethod
    def post():
        #params = {'symbol', 'call_id'}
        #args = create_parser(params).parse_args()
        try:
            #call method to cancel all orders
        except Exception as error:
            print(error)


# send stop loss order
class send_sl(Resource):
    @staticmethod
    def post():
        #params = {'side', 'symbol', 'leverage', 'price', 'stoploss', 'call_id'}
        #args = create_parser(params).parse_args()
        try:
            #call method to send stop loss
        except Exception as error:
            print(error)


# createParser for code reduction, rn only required=True works
def create_parser(params):
    parser = reqparse.RequestParser()
    for param in params:
        parser.add_argument(param, required=True)
    return parser

api.add_resource(send_call, '/send_call')
api.add_resource(send_tp, '/send_tp')
api.add_resource(cancel_order, '/cancel_order')
api.add_resource(cancel_all_orders, '/cancel_all_orders')
api.add_resource(send_sl, '/send_sl')

app.run()
