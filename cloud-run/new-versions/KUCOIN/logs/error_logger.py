import traceback
from .logger_config import get_custom_logger

# Get a custom logger
logger = get_custom_logger("cloudLogger")

def log_error(trader_id, trade_id, error):
    error_message = f"{type(error).__name__}: {error}"
    # Get the last line of the traceback which contains the error details
    stack_trace = traceback.format_exc()
    last_call_stack = traceback.extract_tb(error.__traceback__)[-1]
    file_name = last_call_stack.filename
    line_number = last_call_stack.lineno
    code_snippet = last_call_stack.line

    # Structure to store log
    log = {
        "trader_id": trader_id,
        "trade_id": trade_id,
        "error": error_message,
        "file_name": file_name,
        "line_number": line_number,
        "code_snippet": code_snippet,
        "stack_trace": stack_trace
    }

    # Log the error
    logger.error(log)