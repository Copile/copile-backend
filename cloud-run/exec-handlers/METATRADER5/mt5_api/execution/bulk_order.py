import asyncio
import MetaTrader5 as mt5
from api.perpetual import place_order, start_mt5, retrieve_latest_tick
from scripts.settings import reformat_symbol, get_precision
from utils.firestore import store_trade, store_sl, store_tp

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
        
        trade_info = {
            "trade_id": trade_id,
            "order_id": initial_order,
            "symbol": symbol,
            "type": "Market" if price == 0 else "Limit",
            "side": side,
            "quantity": quantity,
            "entry": entry if entry != 'market' else market_price,
            "leverage": 0,
            "margin": margin,
            "exchange": "MT5"
        }

        await store_trade(trader_id, account_id, trade_info)

        tp_dict = {
            "order_id": 0,
            "tp_number": 1,
            "tp_value": take_profit_price,
            "tp_percentage": 1,
            "tp_amount": 1
        }

        sl_dict = {
            "order_id": 0,
            "sl_number": 1,
            "sl_value": stop_loss_price,
            "sl_percentage": 1,
            "sl_amount": 1
        }

        await asyncio.gather(
            store_tp(trader_id, account_id, tp_dict),
            store_sl(trader_id, account_id, sl_dict)
        )

    except Exception as e:
        print(e)