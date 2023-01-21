from kucoin_futures.client import Trade, Market

api_key = "637967ef0adca800011fd0a6"
api_secret = "11b7ceaf-7a2a-4134-8503-247642a01fe3"
api_passphrase = "mira12345678"


def kucoin_trade(uuid, side, symbol, leverage, Margin, price):

    # Connecting to Kucoin API
    client_trade = Trade(key=api_key, secret=api_secret, passphrase=api_passphrase, is_sandbox=False, url='')
    client = Market(key=api_key, secret=api_secret, passphrase=api_passphrase, is_sandbox=False, url='')

    side = 'buy' if side == 'Buy' else 'sell'

    # Fixing symbol, because of exceptions
    if symbol == "BTCUSDT":
        symbol = "XBTUSDTM"
    else:
        symbol = f"{symbol}M"

    # Getting round precision for future use
    multiplier = client.get_contract_detail(symbol=symbol)['multiplier']
    min_qty = 1 * float(multiplier)
    precision = int(len(str(min_qty).split(".")[1]))

    # Calculation right lot size for trade size
    quantity = (round((float(Margin) * int(leverage) / float(price)), precision)) / float(multiplier)

    # Placing Limit Order
    try:
        create_order = client_trade.create_limit_order(
            symbol=symbol,
            size=quantity,
            price=str(price),
            side=side,
            lever=str(int(leverage)),
            type='limit'
        )
        print(create_order)
        return f"**Successfully placed order! - {uuid} - {symbol}**"
    except Exception as error:
        print(error)


kucoin_trade(1312312, "Buy", "BTCUSDT", 13, 10, 20500)
