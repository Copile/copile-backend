from .pybit.unified_trading import HTTP
from ..firestore_functions import get_user_plan

async def get_user_margin(account_id, plan_id, trader_id, keys):
    try:
        plan_object = await get_user_plan(account_id, plan_id, trader_id)

        # Connecting to Bybit API
        session = HTTP(
            testnet=False,
            api_key=keys["api_key"],
            api_secret=keys["api_secret"],
        )

        if plan_object["option"] == "percent":
                account_type_fetch = await session.get_account_info()
                account_type = "CONTRACT" if account_type_fetch["result"]["unifiedMarginStatus"] == 1 else "UNIFIED"
                fetch = await session.get_wallet_balance(accountType=account_type, coin="USDT")
                balance = fetch['result']['list'][0]['coin'][0]['equity']
                margin = round(float(balance) * float(plan_object["percentage"]), 1)
                return margin
        elif plan_object["option"] == "margin":
            return float(plan_object["margin"])
        else:
            return "No margin found!"
    except Exception as error:
        print(error)