import sys
import functions_framework
from apis.bybit_cancel import bybit_cancel

@functions_framework.cloud_event
def cancel(event):
    # with event input data, call bybit_cancel, send back result
    return bybit_cancel(event['data']['side'], event['data']['symbol'], event['data']['API_KEY'], event['data']['API_SECRET']);

sys.modules[__name__] = cancel