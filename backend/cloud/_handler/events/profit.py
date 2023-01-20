import sys
import functions_framework
from apis.bybit_trade import bybit_profit

@functions_framework.cloud_event
def profit(event):
    # with event input data, call bybit_cancel, send back result
    return bybit_profit(event['data']['side'], event['data']['symbol'], event['data']['leverage'], event['data']['Margin'], event['data']['price'], event['data']['API_KEY'], event['data']['API_SECRET'], event['data']['member'])

sys.modules[__name__] = profit
