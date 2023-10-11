from .bingX.perpetual.v2.Perpetual import Perpetual
from ..firestore_functions import get_user_plan
from ..notification import send_notification
from .error_handler import handle_error
import asyncio

async def get_user_margin(account_id, plan_id, keys):
    try:
        plan_object = await get_user_plan(account_id, plan_id)
        client = Perpetual(api_key=keys["api_key"], api_secret=keys["api_secret"])

        if plan_object["option"] == "percent":
                balance = await client.balance()
                margin = round(float(balance["balance"]["availableMargin"]) * float(plan_object["percentage"]), 1)
                return margin
        elif plan_object["option"] == "margin":
            print(float(plan_object["margin"]))
            return float(plan_object["margin"])
        else:
            await handle_error(account_id, 50001, None, keys)
            return "No margin found!"
    except Exception as error:
        print(error)