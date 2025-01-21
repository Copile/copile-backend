from utils.firestore import get_specific_order, delete_tp_sl_order

async def send_cancel(session, symbol, user_id, trader_id, trade_id, document_id, trade_type):
    order = await get_specific_order(trader_id, user_id, trade_id, document_id, trade_type)

    await session.cancel_order(symbol, order['orderID'], None)
    await delete_tp_sl_order(trader_id, user_id, trade_id, document_id, trade_type)

    return