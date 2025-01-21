def message_bulk_order(trade_id, trade_info, take_profits, stop_losses):
    return {
        "action": "bulk_order",
        "tradeId": trade_id,
        "order": trade_info,
        "take-profits": take_profits,
        "stop-losses": stop_losses
    }


def message_send_sl(trade_id, stop_loss):
    return {
        "action": "send_sl",
        "tradeId": trade_id,
        "stop-loss": stop_loss
    }


def message_replace_sl(trade_id, document_id, stop_loss):
    return {
        "action": "replace_sl",
        "tradeId": trade_id,
        "document_id": document_id,
        "stop-loss": stop_loss
    }


def message_cancel_order(trade_id, document_id, trade_type):
    return {
        "action": "cancel_order",
        "tradeId": trade_id,
        "document_id": document_id,
        "trade_type": trade_type
    }


def message_cancel_orders(trade_id):
    return {
        "action": "cancel_all_orders",
        "tradeId": trade_id
    }


def message_cancel_all_tps(trade_id, tp_orders):
    return {
        "action": "cancel_all_tps",
        "tradeId": trade_id,
        "cancelled_orders": tp_orders
    }


def message_bulk_tp(trade_id, take_profits):
    return {
        "action": "bulk_tp",
        "tradeId": trade_id,
        "take-profits": take_profits
    }


def message_partial_close(trade_id, new_quantity, take_profits, stop_losses):
    return {
        "action": "partial_close",
        "tradeId": trade_id,
        "new_quantity": new_quantity,
        "take-profits": take_profits,
        "stop-losses": stop_losses
    }
