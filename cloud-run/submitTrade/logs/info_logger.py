from .logger_config import get_custom_logger

# Get a custom logger
logger = get_custom_logger("cloudLogger")

class LogInfo:
    """
        Base class for logging basic info.
    """

    def __init__(self, trader_id, trade_id):
        self.trader_id = trader_id
        self.trade_id = trade_id

    def info(self, message):
        log_info(self.trader_id, self.trade_id, message)


# Function to store info logs
def log_info(trader_id, trade_id, message):
    
    # Structure to store log
    log = {
        "trader_id": trader_id,
        "trade_id": trade_id,
        "message": message
    }

    # Log the info
    logger.info(log)