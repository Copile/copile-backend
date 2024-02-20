import datetime
import MetaTrader5 as mt5

def start_mt5(username, password, server):
    """
    Initializes and logs into MT5
    :param username: 8 digit integer
    :param password: string
    :param server: string
    :param path: string
    :return: True if successful, Error if not
    """
    # Ensure that all variables are the correct type
    uname = int(username)  # Username must be an int
    pword = str(password)  # Password must be a string
    trading_server = str(server)  # Server must be a string

    # Attempt to start MT5
    try:
        metaTrader_init = mt5.initialize(login=uname, password=pword, server=trading_server)
    except Exception as e:
        print(f"Error initializing MetaTrader: {e}")

    # Attempt to login to MT5
    if not metaTrader_init:
        print("Error")
    else:
        try:
            metaTrader_login = mt5.login(login=uname, password=pword, server=trading_server)
        except Exception as e:
            print(f"Error loging in to MetaTrader: {e}")

    # Return True if initialization and login are successful
    if metaTrader_login:
        return True

# Function to place a trade on MT5
def place_order(order_type, symbol, volume, stop_loss, take_profit, comment, direct=False, price=0):
    """
    Function to place a trade on MetaTrader 5 with option to check balance first
    :param order_type: String from options: SELL_STOP, BUY_STOP, SELL, BUY
    :param symbol: String
    :param volume: String or Float
    :param stop_loss: String or Float
    :param take_profit: String of Float
    :param comment: String
    :param direct: Bool, defaults to False
    :param price: String or Float, optional
    :return: Trade outcome or syntax error
    """

    # Set up the place order request
    request = {
        "symbol": symbol,
        "volume": volume,
        "comment": comment
    }

    if stop_loss is not None:
        request["sl"] = float(stop_loss)

    if take_profit is not None:
        request["tp"] = float(take_profit)


    # Create the order type based upon provided values. This can be expanded for different order types as needed.
    if order_type == "BUY":
        request['type_filling'] = mt5.ORDER_FILLING_FOK
        if price != 0:
            request['type'] = mt5.ORDER_TYPE_BUY_LIMIT
            request['action'] = mt5.TRADE_ACTION_PENDING
            request['price'] = float(price)
        else:
            request['type'] = mt5.ORDER_TYPE_BUY
            request['action'] = mt5.TRADE_ACTION_DEAL
    
    elif order_type == "SELL":
        request['type_filling'] = mt5.ORDER_FILLING_FOK
        if price != 0:
            request['price'] = float(price)
            request['type'] = mt5.ORDER_TYPE_SELL_LIMIT
            request['action'] = mt5.TRADE_ACTION_PENDING
        else:
            request['type'] = mt5.ORDER_TYPE_SELL
            request['action'] = mt5.TRADE_ACTION_DEAL

    elif order_type == "SELL_STOP":
        request['type'] = mt5.ORDER_TYPE_SELL_STOP
        request['action'] = mt5.TRADE_ACTION_PENDING
        if price <= 0:
            print("Incorrect Price")
        else:
            request['price'] = float(price)
            request['type_filling'] = mt5.ORDER_FILLING_FOK
    
    elif order_type == "BUY_STOP":
        request['type'] = mt5.ORDER_TYPE_BUY_STOP
        request['action'] = mt5.TRADE_ACTION_PENDING
        if price <= 0:
            print("Incorrect Price")
        else:
            request['price'] = float(price)
            request['type_filling'] = mt5.ORDER_FILLING_FOK

    else:
        print("Choose a valid order type from SELL_STOP, BUY_STOP, SELL, BUY")
        raise SyntaxError

    if direct is True:
        print(request)
        # Send the order to MT5
        order_result = mt5.order_send(request)
        # Notify based on return outcomes
        if order_result[0] == 10009:
            # Print result
            # print(f"Order for {symbol} successful") # Enable if error checking order_result
            return order_result[2]
        elif order_result[0] == 10027:
            # Turn off autotrading
            print(f"Turn off Algo Trading on MT5 Terminal")
        else:
            # Print result
            print(f"Error placing order. ErrorCode {order_result[0]}, Error Details: {order_result}")

    else:
        # Check the order
        print(request)
        result = mt5.order_check(request)
        print(result)
        if result[0] == 0:
            # print("Balance Check Successful") # Enable to error check Balance Check
            # If order check is successful, place the order. Little bit of recursion for fun.
            place_order(
                order_type=order_type,
                symbol=symbol,
                volume=volume,
                price=price,
                stop_loss=stop_loss,
                take_profit=take_profit,
                comment=comment,
                direct=True
            )
        else:
            print(f"Order unsucessful. Details: {result}")
            raise mt5.MetaTraderOrderCheckError

# Function to cancel an order
def cancel_order(order_number):
    """
    Function to cancel an order
    :param order_number: Int
    :return:
    """
    # Create the request
    request = {
        "action": mt5.TRADE_ACTION_REMOVE,
        "order": order_number,
        "comment": "Order Removed"
    }
    # Send order to MT5
    order_result = mt5.order_send(request)
    if order_result[0] == 10009:
        return True
    else:
        print(f"Error cancelling order. Details: {order_result}")

# Function to modify an open position
def modify_position(order_number, symbol, new_stop_loss, new_take_profit):
    """
    Function to modify a position
    :param order_number: Int
    :param symbol: String
    :param new_stop_loss: Float
    :param new_take_profit: Float
    :return: Boolean
    """
    # Create the request
    request = {
        "action": mt5.TRADE_ACTION_SLTP,
        "symbol": symbol,
        "sl": float(new_stop_loss),
        "tp": float(new_take_profit),
        "position": order_number
    }
    # Send order to MT5
    order_result = mt5.order_send(request)
    if order_result[0] == 10009:
        return True
    else:
        print(f"Error modifying position. Details: {order_result}")


# Function to retrieve all open orders from MT5
def get_open_orders():
    """
    Function to retrieve a list of open orders from MetaTrader 5
    :return: List of open orders
    """
    orders = mt5.orders_get()
    order_array = []
    for order in orders:
        order_array.append(order[0])
    return order_array


# Function to retrieve all open positions
def get_open_positions():
    """
    Function to retrieve a list of open orders from MetaTrader 5
    :return: list of positions
    """
    # Get position objects
    positions = mt5.positions_get()
    # Return position objects
    return positions


# Function to close an open position
def close_position(order_number, symbol, volume, order_type, price, comment):
    """
    Function to close an open position from MetaTrader 5
    :param order_number: int
    :return: Boolean
    """
    # Create the request
    request = {
        'action': mt5.TRADE_ACTION_DEAL,
        'symbol': symbol,
        'volume': volume,
        'position': order_number,
        'price': price,
        'type_time': mt5.ORDER_TIME_GTC,
        'type_filling': mt5.ORDER_FILLING_IOC,
        'comment': comment
    }

    if order_type == "SELL":
        request['type'] = mt5.ORDER_TYPE_SELL
    elif order_type == "BUY":
        request['type'] = mt5.ORDER_TYPE_BUY
    else:
        print(f"Incorrect syntax for position close {order_type}")
        raise SyntaxError

    # Place the order
    result = mt5.order_send(request)
    if result[0] == 10009:
        return True
    else:
        print(f"Error closing position. Details: {result}")


# Function to retrieve latest tick for a symbol
def retrieve_latest_tick(symbol):
    """
    Function to retrieve the latest tick for a symbol
    :param symbol: String
    :return: Dictionary object
    """
    # Retrieve the tick information
    tick = mt5.symbol_info_tick(symbol)._asdict()
    spread = tick['ask'] - tick['bid']
    tick['spread'] = spread
    return float(tick['bid'])