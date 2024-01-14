import logging
import google.cloud.logging
from google.cloud.logging_v2.handlers import CloudLoggingHandler

class SingletonMeta(type):
    """
    A metaclass that creates a Singleton instance.
    """
    _instances = {}

    def __call__(cls, *args, **kwargs):
        if cls not in cls._instances:
            cls._instances[cls] = super(SingletonMeta, cls).__call__(*args, **kwargs)
        return cls._instances[cls]

class CloudLoggingClient(metaclass=SingletonMeta):
    """
    Singleton class for Google Cloud Logging client.
    """
    def __init__(self):
        self.client = google.cloud.logging.Client()

    def get_client(self):
        return self.client

def get_custom_logger(logger_name, level):
    # Get the singleton Google Cloud Logging client
    client = CloudLoggingClient().get_client()

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
