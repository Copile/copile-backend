import sys
import functions_framework
from apis.bybit_trade import bybit_stoploss

@functions_framework.cloud_event
def stoploss(event):
    # with event input data, call bybit_cancel, send back result
    return bybit_stoploss(event['data']['side'], event['data']['symbol'], event['data']['leverage'], event['data']['Margin'], event['data']['price'], event['data']['stoploss'], event['data']['API_KEY'], event['data']['API_SECRET'], event['data']['call_ID'], event['data']['discord_ID']);

sys.modules[__name__] = stoploss
