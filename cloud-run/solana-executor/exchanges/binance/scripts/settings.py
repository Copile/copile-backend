def get_position_quantity(position, trade_info):
    if float(position['positionAmt']) != 0:
        position_quantity = abs(float(position['positionAmt']))
    else:
        position_quantity = trade_info["quantity"]
    return float(position_quantity)