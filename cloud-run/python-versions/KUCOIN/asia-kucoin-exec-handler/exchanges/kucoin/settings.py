from .kuclib.client import Market

def reformat_symbol(symbol):
    if symbol.endswith("M"):
        # If the symbol already ends with "M", do nothing
        return symbol
    elif symbol == "BTCUSDT":
        return "XBTUSDTM"
    else:
        return f"{symbol}M"
    
async def get_market(symbol, keys):
    try:
        client = Market(key=keys['api_key'], secret=keys['api_secret'], passphrase=keys['api_passphrase'], is_sandbox=False, url='')

        fetch = await client.get_ticker(symbol="XRPUSDTM")
        market_price = fetch["price"]
        return float(market_price)
    except Exception as error:
        print(error)