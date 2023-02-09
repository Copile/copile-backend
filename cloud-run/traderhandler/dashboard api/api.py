from flask import Flask, request
from ..exchanges import binance, kucoin, bybit, mexc
import os

EXCHANGES = {
    'binance': binance,
    'kucoin': kucoin,
    'bybit': bybit,
    'mexc': mexc
    # ... add other exchanges here
}
app = Flask(__name__)


# send calls
@app.route('/send_call', methods=['POST'])
def send_call():
    try:
        # call method to start trade
        EXCHANGES[request.form['exchange_name']].trade.send_trade(request.form['uuid'], request.form['side'],
                                                                  request.form['symbol'], request.form['leverage'],
                                                                  request.form['Margin'], request.form['price'])
        print("call sent:", request.data)

    except Exception as error:
        print(error)


# send takeprofit
@app.route('/send_tp', methods=['POST'])
def send_tp():
    try:
        # call method to sent tp
        EXCHANGES[request.form['exchange_name']].profit.send_takeprofit(request.form['uuid'], request.form['side'],
                                                                        request.form['TP'],
                                                                        request.form['TP_Percentage'])
        print("take profit sent:", request.data)

    except Exception as error:
        print(error)


# cancel single order
@app.route('/cancel_order', methods=['POST'])
def cancel_order():
    try:
        # call method to cancel one order
        EXCHANGES[request.form['exchange_name']].cancel.send_cancel(request.form['uuid'], request.form['symbol'],
                                                                    request.form['order_id'])
        print("cancelled order:", request.form['uuid'])
    except Exception as error:
        print(error)


# cancel all orders
@app.route('/cancel_all_orders', methods=['POST'])
def cancel_all_orders():
    try:
        # call method to cancel all orders
        EXCHANGES[request.form['exchange_name']].emergency.send_emergency(request.form['uuid'], request.form['side'],
                                                                          request.form['symbol'])
        print("cancelled all orders:", request.data)
    except Exception as error:
        print(error)


# send stoploss
@app.route('/send_sl', methods=['POST'])
def send_sl():
    try:
        # call method to send stop loss
        EXCHANGES[request.form['exchange_name']].stoploss.send_stoploss(request.form['uuid'], request.form['side'],
                                                                        request.form['symbol'])
        print("stoploss sent:", request.data)
    except Exception as error:
        print(error)


if __name__ == '_main_':
    app.run(debug=True, host='0.0.0.0', port=int(os.environ.get("PORT", 8080)))
