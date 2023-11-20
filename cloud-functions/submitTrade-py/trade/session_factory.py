from exchanges.bingx.api.session import BingXSession

def create_session(exchange, api_key, api_secret, api_passphrase=None):

    if exchange == "kucoin":
        # return KuCoinSession(api_key, api_secret, api_passphrase)
        pass
    elif exchange == "binance":
        # return BinanceSession(api_key, api_secret)
        pass
    elif exchange == "bingx":
        return BingXSession(api_key, api_secret)
    elif exchange == "testnet":
        # return TestnetSession(api_key, api_secret)
        pass
    else:
        return