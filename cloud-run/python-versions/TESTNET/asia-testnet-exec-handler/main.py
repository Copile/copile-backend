import base64
import json
import os
import asyncio
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from exchanges import bybit
from exchanges.firestore_functions import get_trade_info, get_tp_sl_orders, get_user_keys, change_collection, get_tp_sl_info
from exchanges.partial import distribute_percentages

app = FastAPI()

@app.post('/replace_tp')
async def replace_sl(data: dict):
    user_type = data['user_type']
    change_collection(user_type)
    trade_id = data['trade_id']
    account_id = data['account_id']
    order_id = data['document_id']
    payload = data['payload']
    exchange = data['exchange']

    # Validate the inputs
    trade_info, keys = await asyncio.gather(
        get_trade_info(account_id, trade_id),
        get_user_keys(account_id, exchange)
    )
    
    try:
        fetch_quantity, precision = await asyncio.gather(
            get_tp_sl_info(account_id, trade_id, order_id, "tp"),
            bybit.precision.get_precision(account_id, trade_info["symbol"], keys)
        )

        # Get current quantity of tp
        tp_quantity = fetch_quantity["tp_amount"]

        # Cancel the order
        await bybit.cancel.send_cancel(account_id, trade_id, order_id, "tp", trade_info, keys)

        # Resend the tp with the updated payload
        await bybit.profit.send_profit(account_id, trade_id, payload['tp_id'], payload['tp_number'], payload['tp_value'], payload['tp_percentage'], float(tp_quantity), trade_info, precision, keys)

        return {"message": f"Replaced take-profit order for trade {trade_id}"}, 200

    except ConnectionError as error:
        print(error)
        raise HTTPException(status_code=503, detail="Connection error. Please try again later.")

    except Exception as error:
        print(error)
        raise HTTPException(status_code=500, detail=str(error))

@app.post('/replace_sl')
async def replace_sl(data: dict):
    user_type = data['user_type']
    change_collection(user_type)
    trade_id = data['trade_id']
    account_id = data['account_id']
    order_id = data['document_id']
    payload = data['payload']
    exchange = data['exchange']

    # Validate the inputs
    trade_info, keys = await asyncio.gather(
        get_trade_info(account_id, trade_id),
        get_user_keys(account_id, exchange)
    )
    
    try:
        position_quantity, precision, cancel_order, partial_mode = await asyncio.gather(
            bybit.position.get_position(account_id, trade_id, trade_info, keys),
            bybit.precision.get_precision(account_id, trade_info["symbol"], keys),
            bybit.cancel.send_cancel(account_id, trade_id, order_id, "sl", trade_info, keys),
            bybit.settings.change_partial_mode(trade_info["symbol"], keys)
        )

        if position_quantity != 0:
            # Resend the sl with the updated payload
            await bybit.stoploss.send_stoploss(account_id, trade_id, payload['sl_id'], payload['sl_number'], payload['sl_value'], payload['sl_percentage'], float(position_quantity), trade_info, precision, keys)
        else:
            position_quantity = trade_info["quantity"]
            # Resend the sl with the updated payload
            await bybit.stoploss.send_stoploss(account_id, trade_id, payload['sl_id'], payload['sl_number'], payload['sl_value'], payload['sl_percentage'], float(position_quantity), trade_info, precision, keys)

        return {"message": f"Replaced stop loss order for trade {trade_id}"}, 200

    except ConnectionError as error:
        print(error)
        raise HTTPException(status_code=503, detail="Connection error. Please try again later.")

    except Exception as error:
        print(error)
        raise HTTPException(status_code=500, detail=str(error))

# cancel single order
@app.post('/cancel_order')
async def cancel_order(data: dict):
    user_type = data['user_type']
    change_collection(user_type)
    trade_id = data['trade_id']
    account_id = data['account_id']
    document_id = data['document_id']
    trade_type = data['trade_type']
    exchange = data['exchange']

    trade_info, keys = await asyncio.gather(
        get_trade_info(account_id, trade_id),
        get_user_keys(account_id, exchange)
    )

    try:
        # call method to cancel one order
        await bybit.cancel.send_cancel(account_id, trade_id, document_id, trade_type, trade_info, keys)
        return {"message": f"Cancelled order: {trade_id}"}

    except ConnectionError as error:
        raise HTTPException(status_code=503, detail="Connection error. Please try again later.")

    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))


# cancel all orders
@app.post('/cancel_all_orders')
async def cancel_all_orders(data: dict):
    user_type = data['user_type']
    change_collection(user_type)
    trade_id = data['trade_id']
    account_id = data['account_id']
    exchange = data['exchange']

    trade_info, keys = await asyncio.gather(
        get_trade_info(account_id, trade_id),
        get_user_keys(account_id, exchange)
    )

    try:
        # call method to cancel all orders
        await bybit.emergency.send_emergency(account_id, trade_id, trade_info, keys)
        return {"message": "Cancelled all orders"}

    except ConnectionError as error:
        print(error)
        raise HTTPException(status_code=503, detail="Connection error. Please try again later.")

    except Exception as error:
        print(error)
        raise HTTPException(status_code=500, detail=str(error))

@app.post('/cancel_all_tps')
async def cancel_all_tps(data: dict):
    user_type = data['user_type']
    change_collection(user_type)
    account_id = data['account_id']
    trade_id = data['trade_id']
    exchange = data['exchange']

    trade_info, keys = await asyncio.gather(
        get_trade_info(account_id, trade_id),
        get_user_keys(account_id, exchange)
    )

    try:
        await bybit.clear.clear_tps_sls(account_id, trade_id, "tp", trade_info, keys)

        return JSONResponse(content={"message": "All take profits cancelled successfully"}, status_code=200)

    except Exception as error:
        print(error)
        raise HTTPException(status_code=500, detail=str(error))

@app.post('/bulk_tp')
async def bulk_tp(data: dict):
    user_type = data['user_type']
    change_collection(user_type)
    trade_id = data['trade_id']
    take_profits = data['take_profits']
    account_id = data['account_id']
    exchange = data['exchange']

    keys, trade_info = await asyncio.gather(
        get_user_keys(account_id, exchange),
        get_trade_info(account_id, trade_id)
    )

    try:

        position_quantity, precision, partial_mode = await asyncio.gather(
            bybit.position.get_position(account_id, trade_id, trade_info, keys),
            bybit.precision.get_precision(account_id, trade_info["symbol"], keys),
            bybit.settings.change_partial_mode(trade_info["symbol"], keys)
        )

        new_take_profits = []

        if position_quantity != 0:
            new_take_profits = await bybit.distribution.calculate_tp_amounts(account_id, trade_id, take_profits, trade_info, position_quantity, precision, keys)
        else:
            position_quantity = trade_info["quantity"]     
            new_take_profits = await bybit.distribution.calculate_tp_amounts(account_id, trade_id, take_profits, trade_info, position_quantity, precision, keys)

        tasks = [bybit.profit.send_profit(account_id, trade_id, tp_data["tp_id"], tp_data["tp_number"], tp_data["tp_value"], tp_data["tp_percentage"], tp_data["tp_amount"], trade_info, precision, keys) for tp_data in new_take_profits]
        await asyncio.gather(*tasks)

        response_data = {
            "message": f"Take profit orders processed: {trade_id}",
            "take_profit_results": new_take_profits,
        }

        return response_data

    except ConnectionError as error:
        print(error)
        raise HTTPException(status_code=503, detail="Connection error. Please try again later.")

    except Exception as error:
        print(error)
        raise HTTPException(status_code=500, detail=str(error))


@app.post('/bulk_order')
async def bulk_order(data: dict):
    user_type = data['user_type']
    change_collection(user_type)
    trade_id = data['trade_id']
    account_id = data['account_id']
    payload = data['payload']

    if user_type == "traders":
        margin = data['margin']
    else:
        margin = data['plan_id']
    trader_id = data['trader_id']
    exchange = data['exchange']
    side = payload['side']
    symbol = payload['symbol']
    leverage = payload['leverage']
    entry = payload['entry']
    take_profits = payload['take_profits']
    stop_losses = payload['stop_losses']
    
    try:
        keys = await get_user_keys(account_id, exchange)

        precision, leverage_change, margin_type, position_mode = await asyncio.gather(
            bybit.precision.get_precision(account_id, symbol, keys),
            bybit.settings.change_leverage(symbol, leverage, keys),
            bybit.settings.change_margin_type(keys),
            bybit.settings.change_position_mode(keys)
        )

        trade_quantity = await bybit.trade.send_trade(account_id, trade_id, margin, trader_id, side, symbol, leverage, entry, precision, keys)

        trade_info = await get_trade_info(account_id, trade_id)

        for sl_data in stop_losses:
            await bybit.stoploss.send_stoploss(account_id, trade_id, sl_data['sl_id'], sl_data['sl_number'], sl_data['sl_value'], sl_data['sl_percentage'], trade_quantity, trade_info, precision, keys)
        
        # Calculate new take profit amounts
        if take_profits != []:
            
            new_take_profits = await bybit.distribution.calculate_tp_amounts(account_id, trade_id, take_profits, trade_info, float(trade_info["quantity"]), precision, keys)

            tasks = [bybit.profit.send_profit(account_id, trade_id, tp_data["tp_id"], tp_data["tp_number"], tp_data["tp_value"], tp_data["tp_percentage"], tp_data["tp_amount"], trade_info, precision, keys) for tp_data in new_take_profits]
            await asyncio.gather(*tasks)

        return {"message": "All orders placed successfully"}, 200

    except ConnectionError as error:
        print(error)
        raise HTTPException(status_code=503, detail="Connection error. Please try again later.")

    except Exception as error:
        print(error)
        raise HTTPException(status_code=500, detail=str(error))

@app.post('/partial_close')
async def partial_close(data: dict):
    user_type = data['user_type']
    change_collection(user_type)
    account_id = data['account_id']
    trade_id = data['trade_id']
    percentage = float(data['percentage'])
    exchange = data['exchange']
    
    trade_info, keys, tp_sl_orders = await asyncio.gather(
        get_trade_info(account_id, trade_id),
        get_user_keys(account_id, exchange),
        get_tp_sl_orders(account_id, trade_id)
    )

    symbol = trade_info['symbol']

    try:
        position_quantity, precision, quantity_precision = await asyncio.gather(
            bybit.position.get_position(account_id, trade_id, trade_info, keys),
            bybit.precision.get_precision(account_id, symbol, keys),
            bybit.precision.get_quantity_precision(account_id, symbol, keys),
        ) 

        if position_quantity == 0:
            position_quantity = float(trade_info["quantity"])
            new_order = True
        else:
            new_order = False

        quantity_to_sell = round(float(position_quantity) * percentage, quantity_precision)

        new_quantity = round(float(position_quantity) - quantity_to_sell, quantity_precision)

        new_tps_data = []

        if new_order is False:
            sell_order, tps_data = await asyncio.gather(
                bybit.sell.sell_quantity(account_id, trade_id, quantity_to_sell, trade_info, keys),
                bybit.order.get_tps_status(tp_sl_orders, trade_info, keys)
            )
            await bybit.clear.clear_orders(account_id, trade_id, trade_info, keys)
        else:
            cancel_order, tps_data = await asyncio.gather(
                bybit.cancel.send_cancel(account_id, trade_id, None, None, trade_info, keys),
                bybit.order.get_tps_status(tp_sl_orders, trade_info, keys)
            )
            await bybit.clear.clear_orders(account_id, trade_id, trade_info, keys)

        if tps_data != []:
            distributed_tps = await distribute_percentages(tps_data)

            new_tps_data = await bybit.distribution.calculate_tp_amounts(account_id, trade_id, distributed_tps, trade_info, new_quantity, precision, keys)
        if new_order is False:

            await asyncio.gather(
                *[bybit.stoploss.send_stoploss(account_id, trade_id, order["document_id"], order['sl_number'], order["sl_value"], order["sl_percentage"], None, trade_info, precision, keys) for order in tp_sl_orders if order['executed'] == '1' and 'sl_number' in order], 
                *[bybit.profit.send_profit(account_id, trade_id, order["tp_id"], order["tp_number"], order["tp_value"], order["tp_percentage"], order["tp_amount"], trade_info, precision, keys) for order in new_tps_data]
            )
        else:
            unrounded_quantity = float(new_quantity) + 0.5 * 10 ** (-int(quantity_precision))

            margin = round((unrounded_quantity * float(trade_info["entry"])) / int(trade_info["leverage"]), 0)

            await bybit.trade.send_trade(account_id, trade_id, margin, trade_info["side"], trade_info["symbol"], trade_info["leverage"], trade_info["entry"], precision, keys)

            await asyncio.gather(
                *[bybit.stoploss.send_stoploss(account_id, trade_id, order["document_id"], order['sl_number'], order["sl_value"], order["sl_percentage"], None, trade_info, precision, keys) for order in tp_sl_orders if order['executed'] == '1' and 'sl_number' in order], 
                *[bybit.profit.send_profit(account_id, trade_id, order["tp_id"], order["tp_number"], order["tp_value"], order["tp_percentage"], order["tp_amount"], trade_info, precision, keys) for order in new_tps_data]
            )

        return {"message": "Partial close successful"}, 200

    except Exception as error:
        print(error)
        raise HTTPException(status_code=500, detail=str(error))


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=int(os.environ.get("PORT", 8080)))
