import logging
import traceback
import google.cloud.logging
from google.cloud.logging_v2.handlers import CloudLoggingHandler

# Initialize Google Cloud Logging client
client = google.cloud.logging.Client()

# Create a Cloud Logging handler
handler = CloudLoggingHandler(client)

# Configure the logger
logger = logging.getLogger(__name__)
logger.setLevel(logging.ERROR)  # Set to ERROR to log error messages
logger.addHandler(handler)

# Function to log error with specific details
def log_error(trader_id, error, file_name):
    
    # Format the error message
    error_message = f"{type(error).__name__}: {error}"
    stack_trace = traceback.format_exc()

    # Structure to store log
    log = {
        "trader_id": trader_id,
        "error": error_message,
        "file_name": file_name,
        "stack_trace": stack_trace
    }

    # Log the error
    logger.error(log)

    # Optionally, return the log if needed
    return log