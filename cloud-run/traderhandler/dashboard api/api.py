import base64
import json
import logging
import os

from flask import Flask, request, jsonify

from ..exchanges import binance, kucoin, bybit, mexc
from ..exchanges.firestore_functions import get_trade_info

EXCHANGES = {
    'binance': binance,
    'kucoin': kucoin,
    'bybit': bybit,
    'mexc': mexc
    # ... add other exchanges here
}

app = Flask(__name__)

# set up logging
logging.basicConfig(filename='api.log', level=logging.DEBUG,
                    format='%(asctime)s %(levelname)s: %(message)s',
                    datefmt='%Y-%m-%d %H:%M:%S')


# send calls
@app.route('/send_call', methods=['POST'])
def send_call():
    data = json.loads(base64.b64decode(request.data).decode('utf-8'))
    trade_id = data['trade_id']
    account_id = data['account_id']
    payload = data['payload']
    exchange = data['exchange']
    plan_id = data['plan_id']

    side = payload['side']
    symbol = payload['symbol']
    leverage = payload['leverage']
    entry = payload['entry']

    # validate inputs
    error_response = validate_inputs(exchange, [account_id, trade_id, plan_id, side, symbol, leverage, entry])
    if error_response:
        return error_response

    try:
        # call method to start trade
        EXCHANGES[exchange].trade.send_trade(account_id, trade_id, plan_id, side, symbol, leverage, entry)
        logging.info(f"Call sent: {trade_id}")
        return jsonify({"message": f"Call sent: {trade_id}"}), 200

    except ConnectionError as error:
        logging.error(f"Connection error: {error}")
        return jsonify({"error": "Connection error. Please try again later."}), 503

    except Exception as error:
        logging.error(f"Error sending call: {error}")
        return jsonify({"error": str(error)}), 500


# send takeprofit
@app.route('/send_tp', methods=['POST'])
def send_tp():
    data = json.loads(base64.b64decode(request.data).decode('utf-8'))
    trade_id = data['trade_id']
    account_id = data['account_id']
    payload = data['payload']
    tp_document_id = data['tp_id']

    tp_number = payload['tp_number']
    tp_value = payload['tp_value']
    tp_percentage = payload['tp_percentage']

    exchange = get_trade_info(account_id, trade_id)["exchange"]

    # validate inputs
    error_response = validate_inputs(exchange,
                                     [account_id, trade_id, tp_document_id, tp_number, tp_value, tp_percentage])
    if error_response:
        return error_response
    try:
        # call method to sent tp
        EXCHANGES[exchange].profit.send_takeprofit(account_id, trade_id, tp_document_id, tp_number, tp_value,
                                                   tp_percentage)
        logging.info(f"Take profit sent: {trade_id}")
        return jsonify({"message": f"Take profit sent {trade_id}"}), 200

    except ConnectionError as error:
        logging.error(f"Connection error: {error}")
        return jsonify({"error": "Connection error. Please try again later."}), 503

    except Exception as error:
        logging.error(f"Error sending take profit: {error}")
        return jsonify({"error": str(error)}), 500


# send stoploss
@app.route('/send_sl', methods=['POST'])
def send_sl():
    data = json.loads(base64.b64decode(request.data).decode('utf-8'))
    trade_id = data['trade_id']
    account_id = data['account_id']
    payload = data['payload']
    sl_document_id = data['sl_id']

    sl_number = payload['sl_number']
    sl_value = payload['sl_value']
    sl_percentage = payload['sl_percentage']

    exchange = get_trade_info(account_id, trade_id)["exchange"]

    # validate inputs
    error_response = validate_inputs(exchange,
                                     [account_id, trade_id, sl_document_id, sl_number, sl_value, sl_percentage])
    if error_response:
        return error_response
    try:
        # call method to send stop loss
        EXCHANGES[exchange].stoploss.send_stoploss(account_id, trade_id, sl_document_id, sl_number, sl_value,
                                                   sl_percentage)
        logging.info(f"Stop loss sent: {trade_id}")
        return jsonify({"message": f"Stop loss sent {trade_id}"}), 200

    except ConnectionError as error:
        logging.error(f"Connection error: {error}")
        return jsonify({"error": "Connection error. Please try again later."}), 503

    except Exception as error:
        logging.error(f"Error sending stop loss: {error}")
        return jsonify({"error": str(error)}), 500


# cancel single order
@app.route('/cancel_order', methods=['POST'])
def cancel_order():
    data = json.loads(base64.b64decode(request.data).decode('utf-8'))
    trade_id = data['trade_id']
    account_id = data['account_id']
    document_id = data['document_id']
    trade_type = data['trade_type']

    exchange = get_trade_info(account_id, trade_id)["exchange"]

    # validate inputs
    error_response = validate_inputs(exchange, [account_id, trade_id, document_id, trade_type])
    if error_response:
        return error_response
    try:
        # call method to cancel one order
        EXCHANGES[exchange].cancel.send_cancel(account_id, trade_id, document_id, trade_type)
        logging.info(f"Cancelled order: {trade_id}")
        return jsonify({"message": f"Cancelled order: {trade_id}"}), 200

    except ConnectionError as error:
        logging.error(f"Connection error: {error}")
        return jsonify({"error": "Connection error. Please try again later."}), 503

    except Exception as error:
        logging.error(f"Error cancelling order: {error}")
        return jsonify({"error": str(error)}), 500


# cancel all orders
@app.route('/cancel_all_orders', methods=['POST'])
def cancel_all_orders():
    data = json.loads(base64.b64decode(request.data).decode('utf-8'))
    trade_id = data['trade_id']
    account_id = data['account_id']

    exchange = get_trade_info(account_id, trade_id)["exchange"]

    # validate inputs
    error_response = validate_inputs(exchange, [account_id, trade_id])
    if error_response:
        return error_response
    try:
        # call method to cancel all orders
        EXCHANGES[exchange].emergency.send_emergency(account_id, trade_id)
        logging.info(f"Cancelled all orders: {request.data}")
        return jsonify({"message": "Cancelled all orders"}), 200

    except ConnectionError as error:
        logging.error(f"Connection error: {error}")
        return jsonify({"error": "Connection error. Please try again later."}), 503

    except Exception as error:
        logging.error(f"Error cancelling all orders: {error}")
        return jsonify({"error": str(error)}), 500


def validate_inputs(exchange_name, params):
    """
    Validates that the required parameters are not empty or None.
    """
    if exchange_name not in EXCHANGES:
        raise ValueError(f"Exchange {exchange_name} is not supported.")

    for param in params:
        if param is None or param.strip() == "":
            raise ValueError("All parameters are required and cannot be empty.")

    # if not all(char.isdigit() or char == '.' for char in params[-2]):
    # raise ValueError("Invalid value for price/TP/SL, must be numeric.")

    # if not all(char.isdigit() for char in params[-1]):
    # raise ValueError("Invalid value for leverage/margin/TP_percentage/SL_percentage, must be an integer.")


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=int(os.environ.get("PORT", 8080)))
