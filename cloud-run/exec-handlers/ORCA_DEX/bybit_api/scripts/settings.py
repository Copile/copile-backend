def get_position_quantity(position, trade_info):
    if float(position['size']) != 0:
        position_quantity = abs(float(position['size']))
    else:
        position_quantity = trade_info["quantity"]
    return float(position_quantity)
