import sys
import functions_framework
from apis.bybit_trade import bybit

@functions_framework.cloud_event
def buy(event):
    # with event input data, call bybit_cancel, send back result
    return bybit(event['data']['side'], event['data']['symbol'], event['data']['leverage'], event['data']['Margin'], event['data']['price'], event['data']['API_KEY'], event['data']['API_SECRET'], event['data']['member'])
    
sys.modules[__name__] = buy