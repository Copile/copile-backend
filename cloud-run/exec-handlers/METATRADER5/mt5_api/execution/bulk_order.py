import asyncio
from scripts.settings import reformat_symbol, get_precisions, retrieve_latest_tick
from utils.firestore import store_trade, store_sl, store_tp
from api.connection import get_connection

async def bulk_order(token, meta_id, data):
    try:
        trade_id = data['trade_id']
        account_id = data['account_id']
        trader_id = data['trader_id']
        trader_percentage = data['trader_percentage']
        trader_leverage = data['payload']['leverage']

        side = data['payload']['side'].upper()
        entry = data['payload']['entry']
        stop_losses = data['payload']['stop_losses']
        take_profits = data['payload']['take_profits']

        symbol = reformat_symbol(data['payload']['symbol'])

        connection = await get_connection(meta_id, token)

        terminal_state = connection.terminal_state

        margin = round(float(terminal_state.account_information["freeMargin"]) * trader_percentage, 2)

        # Fetching precision for specific symbol
        precision = get_precisions(terminal_state, symbol)
        price_precision = precision['price_precision']
        quantity_precision = precision['quantity_precision']
        
        # Fetching current market price for specific symbol
        market_price = retrieve_latest_tick(terminal_state, symbol)

        quantity = round(((margin * 100) * (trader_leverage / 100)) / market_price, quantity_precision)

        stop_loss_price = float(round(stop_losses[0]['sl_value'] if stop_losses != [] else None, price_precision)) 
        take_profit_price = float(round(take_profits[0]['tp_value'] if take_profits != [] else None, price_precision))

        if entry != 'market':
            if side == "BUY":
                initial_order = await connection.create_market_buy_order(
                    symbol=symbol, volume=quantity, stop_loss=stop_loss_price, take_profit=take_profit_price
                )
            else:
                initial_order = await connection.create_market_sell_order(
                    symbol=symbol, volume=quantity, stop_loss=stop_loss_price, take_profit=take_profit_price
                )
        else:
            if side == "BUY":
                initial_order = await connection.create_limit_buy_order(
                    symbol=symbol, volume=quantity, open_price=round(float(entry), price_precision), stop_loss=stop_loss_price, take_profit=take_profit_price
                )
            else:
                initial_order = await connection.create_limit_sell_order(
                    symbol=symbol, volume=quantity, open_price=round(float(entry), price_precision), stop_loss=stop_loss_price, take_profit=take_profit_price
                )

        trade_info = {
            "trade_id": trade_id,
            "order_id": initial_order['orderId'],
            "symbol": symbol,
            "type": "market" if entry == 'market' else "limit",
            "side": side,
            "quantity": quantity,
            "entry": entry if entry != 'market' else market_price,
            "leverage": 0,
            "margin": margin,
            "exchange": "mt5"
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