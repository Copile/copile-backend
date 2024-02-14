import MetaTrader5 as mt5

# Function to start Meta Trader 5 (MT5)
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