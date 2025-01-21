from .firestore import get_user_plan

async def get_margin(session, user_id, plan_id, worker_id):
    plan_object = await get_user_plan(user_id, plan_id, worker_id)
    if plan_object["option"] == "percent":
                balance = await session.get_balance()
                margin = round(balance * float(plan_object["percentage"]), 1)
                return margin
    elif plan_object["option"] == "margin":
        return float(plan_object["margin"])
    else:
        return "No margin found!"
