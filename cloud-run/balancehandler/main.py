from flask import Flask, request
import os
from .check import check_balance

app = Flask(__name__)


@app.route('/createBalance', methods=['POST'])
def createBalance():
    license = request.data.decode()
    check_balance(license)
    return '{"handled": true}'


if __name__ == '_main_':
    app.run(debug=True, host='0.0.0.0', port=int(os.environ.get("PORT", 8080)))
