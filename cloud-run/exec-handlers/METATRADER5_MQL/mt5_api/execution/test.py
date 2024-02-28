import asyncio
import MetaTrader5 as mt5
from .api.perpetual import place_order, start_mt5, retrieve_latest_tick
from .scripts.settings import reformat_symbol, get_precision

data = {
    "trade_id": "bastardtrade123",
    "account_id": "bastardmt5",
    "trader_id": "bastardtrader",
    "trader_percentage": 0.05,
    "trader_leverage": 20,
    "payload": {
        "side": "BUY",
        "entry": 'market',
        "symbol": "BTCUSDT",
        "take_profits": [
            {
                "tp_id": "1231231312",
                "tp_value": 54000,
                "tp_percentage": 1.0
            }
        ],
        "stop_losses": [
            {
                "sl_id": "123012031",
                "sl_value": 50000,
                "sl_percentage": 1.0
            }
        ]
    }
}

async def bulk_order(login_id, password, server, data):
    try:
        # Create server connection to mt5
        start_mt5(login_id, password, server)

        trade_id = data['trade_id']
        account_id = data['account_id']
        trader_id = data['trader_id']
        trader_percentage = data['trader_percentage']
        trader_leverage = data['trader_leverage']

        side = data['payload']['side'].upper()
        entry = data['payload']['entry']
        stop_losses = data['payload']['stop_losses']
        take_profits = data['payload']['take_profits']

        symbol = reformat_symbol(data['payload']['symbol'])

        margin = round(float(mt5.account_info()._asdict()["margin_free"]) * trader_percentage, 2)

        market_price = retrieve_latest_tick(symbol)

        # Creating logger for info/errors
        #logger = Logger(user_id, trade_id)

        #logger.info(f"Starting bulk order with data: {data}")

        # Fetching precision for specific symbol
        precision = get_precision(symbol)
        price_precision = precision['price_precision']
        quantity_precision = precision['quantity_precision']

        quantity = round(((margin * 100) * (trader_leverage / 100)) / market_price, quantity_precision)

        price = round(entry, price_precision) if entry != 'market' else 0

        stop_loss_price = round(stop_losses[0]['sl_value'] if stop_losses != [] else None, price_precision)
        take_profit_price = round(take_profits[0]['tp_value'] if take_profits != [] else None, price_precision)
        
        #order_type, symbol, volume, stop_loss, take_profit, comment, direct=False, price=0
        initial_order = place_order(side, symbol, quantity, stop_loss_price, take_profit_price, "Python Script", True, price)
        print(initial_order)
    except Exception as e:
        print(e)

asyncio.run(bulk_order(48116, "3Aq^[^^!X£D1Qa3jd", "EvolveMarkets-MT5 Demo Server", data))