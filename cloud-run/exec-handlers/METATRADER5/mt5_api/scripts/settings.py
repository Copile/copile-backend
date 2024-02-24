import MetaTrader5 as mt5

def count_decimals(number):
    decimals = int(len(str(number).split(".")[1])) if number != 1 else 0
    return decimals

def reformat_symbol(symbol):
    if isinstance(symbol, str):
        return symbol[:-1]
    else:
        raise ValueError("Input must be a string")
    
def get_precision(symbol):
    symbol_info = mt5.symbol_info(symbol)
    precision = {"price_precision": count_decimals(symbol_info.point), "quantity_precision": count_decimals(symbol_info.volume_min)}
    return precision