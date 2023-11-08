import json

"""Exception raised for API errors.

    Attributes:
        error_code (int): The error code
"""
class ApiError(Exception):
    error_messages = {}
    error_messages

    @classmethod
    def load_error_messages(cls):
        if not cls.error_messages:
            try:
                with open('cloud-run\BYBIT\\asia-bybit-exec-handler\exchanges\\bybit\errorhandling\error.json', 'r') as f:
                    cls.error_messages = json.load(f)
            except FileNotFoundError:
                print("Error file not found")

    @classmethod
    def get_error_message(cls, error_code):
        cls.load_error_messages()
        error_message = cls.error_messages.get(str(error_code), "Unknown error")
        return (str(error_code), error_message)

    def __init__(self, error_code):
        self.error_message = self.error_messages.get(str(error_code), "Unknown error")
        super().__init__(self.error_message)

    def print_error_messages():
        ApiError.load_error_messages()
        for error_code, error_message in ApiError.error_messages.items():
            print(f"Error code {error_code}: {error_message}")

    
    