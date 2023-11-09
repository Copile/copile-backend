from .bingX.perpetual.v2.Perpetual import Perpetual

async def convert_symbol(symbol):
    index = symbol.find("USDT")
    if index != -1:
        converted_symbol = symbol[:index] + "-" + symbol[index:]
        return converted_symbol
    else:
        return symbol

async def change_margin_type(symbol, keys):
    try:    
        client = Perpetual(api_key=keys["api_key"], api_secret=keys["api_secret"])
        await client.switch_margin_mode(
                symbol=symbol,
                marginType="ISOLATED"
        )
        return   
    except Exception as error:
        return
    
async def change_leverage(symbol, side, leverage, keys):
    try:
        side = "LONG" if side == "Buy" else "SHORT"
        client = Perpetual(api_key=keys["api_key"], api_secret=keys["api_secret"])
        await client.switch_leverage(symbol=symbol, side=side, leverage=int(leverage))
        return
    except Exception as error:
        raise Exception(f"Error changing leverage: {error}")

async def get_market(symbol, keys):
    try:
        client = Perpetual(api_key=keys["api_key"], api_secret=keys["api_secret"])
        fetch_price = await client.ticker(symbol=symbol)
        market_price = fetch_price["lastPrice"]
        return market_price     
    except Exception as error:
        raise Exception(f"Error getting market price: {error}")