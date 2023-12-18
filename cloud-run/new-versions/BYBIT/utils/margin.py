import logging
from .firestore import get_user_plan

logger = logging.getLogger(__name__)

async def get_margin(session, trader_id, plan_id, worker_id):
    try:
        plan_object = await get_user_plan(trader_id, plan_id, worker_id)
        if plan_object["option"] == "percent":
                    balance = await session.get_balance()
                    margin = round(balance * float(plan_object["percentage"]), 1)
                    return margin
        elif plan_object["option"] == "margin":
            return float(plan_object["margin"])
        else:
            return "No margin found!"
    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)
