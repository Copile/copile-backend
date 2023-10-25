from .binlib.um_futures import UMFutures
from ..firestore_functions import get_user_plan

async def get_user_margin(account_id, plan_id, keys):
    try:
        plan_object = await get_user_plan(account_id, plan_id)
        print(plan_object)
        if plan_object["option"] == "percent":
            client = UMFutures(key=keys['api_key'], secret=keys['api_secret'])

            account = await client.balance()
            print(account)
            for item in account:
                if item['asset'] == "USDT":
                    balance = item['availableBalance']
            margin = round(float(balance) * float(plan_object['percentage']), 1)
            return margin
        elif plan_object["option"] == "margin":
            return float(plan_object["margin"])
        else:
            return "No margin found!"
    except Exception as error:
        print(error)