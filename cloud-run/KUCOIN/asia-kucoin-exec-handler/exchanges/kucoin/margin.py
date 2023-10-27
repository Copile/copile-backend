from .kuclib.client import UserData
from ..firestore_functions import get_user_plan

async def get_user_margin(account_id, plan_id, trader_id, keys):
    try:
        plan_object = await get_user_plan(account_id, plan_id, trader_id)

        client = UserData(key=keys["api_key"], secret=keys["api_secret"], passphrase=keys["api_passphrase"], is_sandbox=False, url='')


        if plan_object["option"] == "percent":
                fetch = await client.get_account_overview(currency="USDT")['availableBalance']
                balance = fetch['availableBalance']
                margin = round(float(balance) * float(plan_object["percentage"]), 1)
                return margin
        elif plan_object["option"] == "margin":
            return float(plan_object["margin"])
        else:
            return "No margin found!"
    except Exception as error:
        print(error)