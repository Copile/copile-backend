async def get_tps_status(session, tp_orders, trade_info):
    symbol = trade_info["symbol"]

    fetch_orders = await session.current_orders(symbol=symbol)
    open_orders = fetch_orders["orders"]

    tps_data = []
    active_status = ["NEW", "PARTIALLY_FILLED"]

    for tp_order in tp_orders:
        tp_order_id = tp_order["orderID"]
        matching_open_orders = [open_order for open_order in open_orders if
                                open_order["orderId"] == tp_order_id]
        tp_order["tp_status"] = "active" if matching_open_orders and matching_open_orders[0][
            "status"] in active_status else "filled"
        tps_data.append(tp_order)
    return tps_data