import logging
from uuid import uuid1

logger = logging.getLogger(__name__)


def reformat_symbol(symbol):
    try:
        if symbol.endswith("M"):
            # If the symbol already ends with "M", do nothing
            return symbol
        elif symbol == "BTCUSDT":
            return "XBTUSDTM"
        else:
            return f"{symbol}M"
    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)


def get_position_quantity(position_details, trade_info):
    try:
        position = position_details['currentQty'] if position_details['currentQty'] > 0 else position_details[
                                                                                                 'currentQty'] * (-1)
        if float(position) != 0:
            position_quantity = abs(float(position))
        else:
            position_quantity = trade_info["quantity"]
        return float(position_quantity)
    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)


def create_client_oid():
    return ''.join([each for each in str(uuid1()).split('-')])
