def convert_symbol(symbol):
    index = symbol.find("USDT")
    if index != -1:
        converted_symbol = symbol[:index] + "-" + symbol[index:]
        return converted_symbol
    else:
        return symbol


def get_position_quantity(position, trade_info):
    if len(position) != 0:
        position_quantity = abs(float(position[0]["positionAmt"]))
    else:
        position_quantity = trade_info["quantity"]
    return float(position_quantity)
