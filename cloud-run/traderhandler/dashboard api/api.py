from flask import Flask, request, jsonify
from ..exchanges import binance, kucoin, bybit, mexc
import os
import logging

EXCHANGES = {
    'binance': binance,
    'kucoin': kucoin,
    'bybit': bybit,
    'mexc': mexc
    # ... add other exchanges here
}

app = Flask(__name__)

# set up logging
logging.basicConfig(filename='trading_api.log', level=logging.INFO)


# send calls
@app.route('/send_call', methods=['POST'])
def send_call():
    exchange_name = request.form.get('exchange_name')
    uuid = request.form.get('uuid')
    side = request.form.get('side')
    symbol = request.form.get('symbol')
    leverage = request.form.get('leverage')
    margin = request.form.get('Margin')
    price = request.form.get('price')

    # validate inputs
    error_response = validate_inputs(exchange_name, [uuid, side, symbol, leverage, margin, price])
    if error_response:
        return error_response
    try:
        # call method to start trade
        # a random exchange is chosen to send the call to
        EXCHANGES[exchange_name].trade.send_trade(uuid, side, symbol, leverage, margin, price)
        logging.info(f"Call sent: {request.data}")
        return jsonify({"message": "Call sent"}), 200

    except Exception as error:
        logging.error(f"Error sending call: {error}")
        return jsonify({"error": str(error)}), 500


# send takeprofit
@app.route('/send_tp', methods=['POST'])
def send_tp():
    exchange_name = request.form.get('exchange_name')
    uuid = request.form.get('uuid')
    side = request.form.get('side')
    tp = request.form.get('TP')
    tp_percentage = request.form.get('TP_Percentage')

    # validate inputs
    error_response = validate_inputs(exchange_name, [uuid, side, tp, tp_percentage])
    if error_response:
        return error_response
    try:
        # call method to sent tp
        EXCHANGES[exchange_name].profit.send_takeprofit(uuid, side, tp, tp_percentage)
        logging.info(f"Take profit sent: {request.data}")
        return jsonify({"message": "Take profit sent"}), 200

    except Exception as error:
        logging.error(f"Error sending take profit: {error}")
        return jsonify({"error": str(error)}), 500


# send stoploss
@app.route('/send_sl', methods=['POST'])
def send_sl():
    exchange_name = request.form.get('exchange_name')
    uuid = request.form.get('uuid')
    side = request.form.get('side')
    symbol = request.form.get('symbol')

    # validate inputs
    error_response = validate_inputs(exchange_name, [uuid, side, symbol])
    if error_response:
        return error_response
    try:
        # call method to send stop loss
        EXCHANGES[request.form['exchange_name']].stoploss.send_stoploss(request.form['uuid'], request.form['side'],
                                                                        request.form['symbol'])
        logging.info(f"Stop loss sent: {request.data}")
        return jsonify({"message": "Stop loss sent"}), 200

    except Exception as error:
        logging.error(f"Error sending stop loss: {error}")
        return jsonify({"error": str(error)}), 500


# cancel single order
@app.route('/cancel_order', methods=['POST'])
def cancel_order():
    exchange_name = request.form.get('exchange_name')
    uuid = request.form.get('uuid')
    symbol = request.form.get('symbol')
    order_id = request.form.get('order_id')

    # validate inputs
    error_response = validate_inputs(exchange_name, [uuid, symbol, order_id])
    if error_response:
        return error_response
    try:
        # call method to cancel one order
        EXCHANGES[request.form['exchange_name']].cancel.send_cancel(request.form['uuid'], request.form['symbol'],
                                                                    request.form['order_id'])
        logging.info(f"Cancelled order: {request.data}")
        return jsonify({"message": "Cancelled order"}), 200

    except Exception as error:
        logging.error(f"Error cancelling order: {error}")
        return jsonify({"error": str(error)}), 500


# cancel all orders
@app.route('/cancel_all_orders', methods=['POST'])
def cancel_all_orders():
    exchange_name = request.form.get('exchange_name')
    uuid = request.form.get('uuid')
    side = request.form.get('side')
    symbol = request.form.get('symbol')

    # validate inputs
    error_response = validate_inputs(exchange_name, [uuid, side, symbol])
    if error_response:
        return error_response
    try:
        # call method to cancel all orders
        EXCHANGES[request.form['exchange_name']].emergency.send_emergency(request.form['uuid'], request.form['side'],
                                                                          request.form['symbol'])
        logging.info(f"Cancelled all orders: {request.data}")
        return jsonify({"message": "Cancelled all orders"}), 200

    except Exception as error:
        logging.error(f"Error cancelling all orders: {error}")
        return jsonify({"error": str(error)}), 500


def validate_inputs(exchange_name, required_params):
    if exchange_name not in EXCHANGES:
        return jsonify({"error": f"Exchange '{exchange_name}' not found"}), 400
    if not all([param for param in required_params if param is None]):
        return jsonify({"error": "Missing required parameters"}), 400
    return None


if __name__ == '_main_':
    app.run(debug=True, host='0.0.0.0', port=int(os.environ.get("PORT", 8080)))
