import logging

logger = logging.getLogger(__name__)


def get_position_quantity(position, trade_info):
    try:
        if float(position['positionAmt']) != 0:
            position_quantity = abs(float(position['positionAmt']))
        else:
            position_quantity = trade_info["quantity"]
        return float(position_quantity)
    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)
