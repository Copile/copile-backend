import logging

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


def get_position_quantity(position, trade_info):
    try:
        if float(position['size']) != 0:
            position_quantity = abs(float(position['size']))
        else:
            position_quantity = trade_info["quantity"]
        return float(position_quantity)
    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)
