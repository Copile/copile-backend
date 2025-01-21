def count_decimals(number):
    decimals = int(len(str(number).split(".")[1])) if number != 1 else 0
    return decimals

def reformat_symbol(symbol):
    if isinstance(symbol, str):
        return symbol[:-1]
    else:
        raise ValueError("Input must be a string")

def get_precisions(terminal_state, symbol):
    symbol_info = terminal_state.specification(symbol)
    tick_size = symbol_info['tickSize']
    precision = {"price_precision": int(len(str(tick_size).split(".")[1])) if tick_size != 1 else 0, "quantity_precision": count_decimals(symbol_info['minVolume'])}
    return precision

# Function to retrieve latest tick for a symbol
def retrieve_latest_tick(terminal_state, symbol):
    """
    Function to retrieve the latest tick for a symbol
    :param symbol: String
    :return: Dictionary object
    """
    # Retrieve the tick information
    tick = terminal_state.price(symbol)
    return float(tick['bid'])

