from .pybit.unified_trading import HTTP
import asyncio

async def change_leverage(symbol, leverage, keys):
    try:
        session = HTTP(
            testnet=True,
            api_key=keys["api_key"],
            api_secret=keys["api_secret"],
        )

        leverage_change = await session.set_leverage(
            category="linear",
            symbol=symbol,
            buyLeverage=str(leverage),
            sellLeverage=str(leverage)
        )
        return leverage_change
    except Exception as error:
        return "Changed"

async def change_margin_type(keys):
    try:
        session = HTTP(
            testnet=True,
            api_key=keys["api_key"],
            api_secret=keys["api_secret"],
        )
        margin_mode = await session.set_margin_mode(
                setMarginMode="ISOLATED_MARGIN"
        )
        return margin_mode
    except Exception as error:
        return "Changed"
    
async def change_position_mode(keys):
    try:
        session = HTTP(
            testnet=True,
            api_key=keys["api_key"],
            api_secret=keys["api_secret"],
        )
        position_mode = await session.switch_position_mode(
            category="linear",
            mode=0
        )
        return position_mode
    except Exception as error:
        return "Changed"

async def change_partial_mode(symbol, keys):
    try:
        session = HTTP(
            testnet=True,
            api_key=keys["api_key"],
            api_secret=keys["api_secret"],
        )
        partial_mode = await session.set_tp_sl_mode(
            symbol=symbol,
            tpSlMode="Partial"
        )
        return partial_mode
    except Exception as error:
        return "Changed"

async def get_market(symbol, keys):
    try:
        session = HTTP(
            testnet=True,
            api_key=keys["api_key"],
            api_secret=keys["api_secret"],
        )
        fetch_price = await session.get_tickers(category="linear", symbol=symbol)
        market_price = fetch_price["result"]["list"][0]["markPrice"]
        return market_price     
    except Exception as error:
        print(error)