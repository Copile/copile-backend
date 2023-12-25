import logging
import google.cloud.logging
from google.cloud.logging_v2.handlers import CloudLoggingHandler

def get_custom_logger(logger_name, level):
    # Initialize Google Cloud Logging client
    client = google.cloud.logging.Client()

    # Create a Cloud Logging handler
    handler = CloudLoggingHandler(client)

    # Configure the logger
    logger = logging.getLogger(logger_name)

    if level == 'error':
        logger.setLevel(logging.ERROR)
    elif level == 'info':
        logger.setLevel(logging.INFO)
    else:
        raise ValueError("Invalid log level. Use 'error' or 'info'.")

    logger.addHandler(handler)

    return logger