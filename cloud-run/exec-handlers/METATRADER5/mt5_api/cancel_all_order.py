from api.perpetual import start_mt5, cancel_order, get_open_positions, close_position
#from utils.firestore import get_trade_info
import asyncio
import MetaTrader5 as mt5

async def cancel_all_orders(login_id, password, server, data):
    try:
        # Create server connection to mt5
        start_mt5(login_id, password, server)

        order_id = 7545980

        # Filter open positions
        open_positions = get_open_positions()
        open_positions_dict = {str(position.ticket): position for position in open_positions}

        position = ""

        if str(order_id) in str(open_positions_dict):
            position = True
        else:
            position = False

        if position:
            for pos in open_positions:
                if pos.ticket == order_id:
                    symbol = pos.symbol
                    volume = pos.volume
                    price = 0
                    order_type = "SELL" if pos.type == 0 else "BUY"
                    close_position(order_id, symbol, volume, order_type, price, "Copile Execution")
        else:
            cancel_order(order_id)

    except Exception as e:
        print(e)


asyncio.run(cancel_all_orders(48116, "3Aq^[^^!X£D1Qa3jd", "EvolveMarkets-MT5 Demo Server", None))