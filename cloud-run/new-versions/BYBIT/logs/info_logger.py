from .logger_config import get_custom_logger

# Get a custom logger
logger = get_custom_logger("cloudLogger")

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