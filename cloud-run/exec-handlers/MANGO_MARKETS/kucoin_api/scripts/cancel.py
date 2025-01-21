from utils.firestore import get_specific_order, delete_tp_sl_order

async def send_cancel(session, user_id, trade_id, document_id, trade_type):
    order = await get_specific_order(user_id, trade_id, document_id, trade_type)

    await session.cancel_order(order['orderID'])
    await delete_tp_sl_order(user_id, trade_id, document_id, trade_type)

    return
