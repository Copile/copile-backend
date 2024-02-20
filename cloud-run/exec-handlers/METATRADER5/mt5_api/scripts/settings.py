import MetaTrader5 as mt5

def count_decimals(number):
    if isinstance(number, float):
        _, decimals = str(number).split('.')
        return len(decimals)
    elif isinstance(number, int):
        return 0
    else:
        raise ValueError("Input must be a number.")

def reformat_symbol(symbol):
    if isinstance(symbol, str):
        return symbol[:-1]
    else:
        raise ValueError("Input must be a string")
    
def get_precision(symbol):
    symbol_info = mt5.symbol_info(symbol)
    precision = {"price_precision": count_decimals(float(symbol_info.point)), "quantity_precision": count_decimals(float(symbol_info.volume_min))}
    return precision