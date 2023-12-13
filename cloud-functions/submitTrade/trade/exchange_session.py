class ExchangeSession:
    """
    Base class for implementing different exchange sessions.
    """
    
    def __init__(self, api_key, api_secret):
        """
        Create a new ExchangeSession instance.
        
        :param api_key: The API key for the session.
        :param api_secret: The API secret for the session.
        """
        self.api_key = api_key
        self.api_secret = api_secret