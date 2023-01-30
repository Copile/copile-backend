from flask import Flask,request
import os

app = Flask(__name__)

# send calls
@app.route('/send_call', methods=['POST'])
def send_call():
    try:
        print("call sent:", request.data)
        # call method to start trade
    except Exception as error:
        print(error)

# send takeprofit
@app.route('/send_tp', methods=['POST'])
def send_tp():
    try:
        print("take profit sent:", request.data)
        # call method to sent tp
    except Exception as error:
        print(error)

# cancel single order
@app.route('/cancel_order', methods=['POST'])
def cancel_order():
    try:
        print("cancelled order:", request.data)
        # call method to cancel one order
    except Exception as error:
        print(error)

# cancel all orders
@app.route('/cancel_all_orders', methods=['POST'])
def cancel_all_orders():
    try:
        # call method to cancel all orders
        print("cancelled all orders:", request.data)
    except Exception as error:
        print(error)

# send stoploss
@app.route('/send_sl', methods=['POST'])
def send_sl():
        try:
            # call method to send stop loss
            print("stoploss sent:", request.data)
        except Exception as error:
            print(error)


if __name__ == '_main_':
    app.run(debug=True, host='0.0.0.0', port=int(os.environ.get("PORT", 8080)))
