async def get_tps_status(session, tp_orders, trade_info):
    symbol = trade_info["symbol"]

    open_orders = await session.current_orders(symbol=symbol)

    tps_data = []

    for tp_order in tp_orders:
        if "tp_number" in tp_order:
            tp_order_id = tp_order["orderID"]
            matching_open_orders = [open_order for open_order in open_orders if
                                    open_order["orderId"] == tp_order_id]
            tp_order["tp_status"] = "active" if matching_open_orders and matching_open_orders[0][
                "status"] == "NEW" else "filled"
            tps_data.append(tp_order)
    return tps_data
