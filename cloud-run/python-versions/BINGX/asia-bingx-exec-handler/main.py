import base64
import json
import os
import asyncio
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from exchanges import bingx
from exchanges.firestore_functions import get_trade_info, get_tp_sl_orders, get_user_keys, change_executed_status_tp_sl, change_collection, get_tp_sl_info
from exchanges.notification import send_notification
from exchanges.create_cloud_task import create_task
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
        fetch_quantity, precision, position_quantity = await asyncio.gather(
            get_tp_sl_info(account_id, trade_id, order_id, "tp"),
            bingx.precision.get_precision(account_id, trade_info["symbol"], keys),
            bingx.position.get_position(account_id, trade_id, trade_info, keys)
        )

        # Get current quantity of tp
        tp_quantity = fetch_quantity["tp_amount"]

        # Cancel the order
        await bingx.cancel.send_cancel(account_id, trade_id, order_id, "tp", trade_info, keys)

        # Resend the tp with the updated payload
        if position_quantity != 0:
            await bingx.stoploss.send_stoploss(account_id, trade_id, payload['tp_id'], payload['tp_number'], payload['tp_value'], payload['tp_percentage'], float(tp_quantity), trade_info, precision, keys)
        else:
            payload["tp_amount"] = tp_quantity
            await create_task(account_id, trade_id, payload["tp_id"], payload, '/send_tp', user_type)

        payload = {
            "data": {
                "document_id": payload["tp_id"],
                "sl_value": payload["tp_value"],
                "sl_percentage": payload["tp_percentage"]
            },
            "trade_id": trade_id,
            "user_id": account_id
        }
        await send_notification(payload, "/action?type=replaceTP")

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
        position_quantity, precision = await asyncio.gather(
            bingx.position.get_position(account_id, trade_id, trade_info, keys),
            bingx.precision.get_precision(account_id, trade_info["symbol"], keys)
        )

        # Cancel the order
        await bingx.cancel.send_cancel(account_id, trade_id, order_id, "sl", trade_info, keys)

        # Resend the sl with the updated payload
        if position_quantity != 0:
            await bingx.stoploss.send_stoploss(account_id, trade_id, payload['sl_id'], payload['sl_number'], payload['sl_value'], payload['sl_percentage'], float(position_quantity), trade_info, precision, keys)
        else:
            await create_task(account_id, trade_id, payload["sl_id"], payload, '/send_sl', user_type)

        payload = {
            "data": {
                "document_id": payload["sl_id"],
                "sl_value": payload["sl_value"],
                "sl_percentage": payload["sl_percentage"]
            },
            "trade_id": trade_id,
            "user_id": account_id
        }
        await send_notification(payload, "/action?type=replaceSL")

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
        await bingx.cancel.send_cancel(account_id, trade_id, document_id, trade_type, trade_info, keys)
        
        payload = {
            "data": {
                "document_id": document_id,
            },
            "trade_id": trade_id,
            "user_id": account_id
        }

        await send_notification(payload, "/action?type=cancelOrder")
        
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
        await bingx.emergency.send_emergency(account_id, trade_id, trade_info, keys)
        
        payload = {
            "trade_id": trade_id,
            "user_id": account_id
        }

        await send_notification(payload, "/action?type=emergencyClose")
        
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
        await bingx.clear.clear_tps_sls(account_id, trade_id, "tp", trade_info, keys)

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

        position_quantity, precision = await asyncio.gather(
            bingx.position.get_position(account_id, trade_id, trade_info, keys),
            bingx.precision.get_precision(account_id, trade_info["symbol"], keys)
        )

        new_take_profits = await bingx.distribution.calculate_tp_amounts(account_id, trade_id, take_profits, trade_info, position_quantity, precision, keys)
        
        if position_quantity != 0:
            tasks = [bingx.profit.send_profit(account_id, trade_id, tp_data["tp_id"], tp_data["tp_number"], tp_data["tp_value"], tp_data["tp_percentage"], tp_data["tp_amount"], trade_info, precision, keys) for tp_data in new_take_profits]
            await asyncio.gather(*tasks)
        else:
            await create_task(account_id, trade_id, None, new_take_profits, "/bulk_tp", user_type)

        response_data = {
            "message": f"Take profit orders processed: {trade_id}",
            "take_profit_results": new_take_profits,
        }

        payload = {
            "data": {
                "take_profits": take_profits
            },
            "trade_id": trade_id,
            "user_id": account_id
        }
        
        await send_notification(payload, "/action?type=bulktp")

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

        symbol = await bingx.settings.convert_symbol(symbol)

        precision, margin_type, leverage_change = await asyncio.gather(
            bingx.precision.get_precision(account_id, symbol, keys),
            bingx.settings.change_margin_type(symbol, keys),
            bingx.settings.change_leverage(symbol, side, leverage, keys)
        )
        order_dict = await bingx.trade.send_trade(account_id, trade_id, margin, trader_id, side, symbol, leverage, entry, precision, keys)

        # parallelize sending stop losses
        sl_tasks = [create_task(account_id, trade_id, sl_data["sl_id"], {
            'sl_id': sl_data["sl_id"],
            'sl_number': sl_data['sl_number'],
            'sl_value': sl_data['sl_value'],
            'sl_percentage': sl_data['sl_percentage'],
            'sl_amount': None
        }, '/send_sl', user_type) for sl_data in stop_losses]
        
        await asyncio.gather(*sl_tasks)
        
        # Calculate new take profit amounts
        if take_profits != []:

            trade_info = await get_trade_info(account_id, trade_id)

            new_take_profits = await bingx.distribution.calculate_tp_amounts(account_id, trade_id, take_profits, trade_info, float(trade_info["quantity"]), precision, keys)

            # Parallelize sending take profits
            await create_task(account_id, trade_id, None, new_take_profits, "/bulk_tp", user_type)

        payload = {
            "data": {
                "order": order_dict,
                "take_profits": take_profits,
                "stop_losses": stop_losses
            },
            "trade_id": trade_id,
            "user_id": account_id
        }

        await send_notification(payload, "/trade")

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
            bingx.position.get_position(account_id, trade_id, trade_info, keys),
            bingx.precision.get_precision(account_id, symbol, keys),
            bingx.precision.get_quantity_precision(account_id, symbol, keys),
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
                bingx.sell.sell_quantity(account_id, trade_id, quantity_to_sell, trade_info, keys),
                bingx.order.get_tps_status(tp_sl_orders, trade_info, keys)
            )
            #await bingx.clear.clear_orders(account_id, trade_id, trade_info, keys)
        else:
            tps_data = [order for order in tp_sl_orders if order["executed"] == "0" in order]
            await asyncio.gather(
                bingx.cancel.send_cancel(account_id, trade_id, None, None, trade_info, keys),
                *[change_executed_status_tp_sl(account_id, trade_id, order['document_id'], order['trade_type'], "1") for order in tp_sl_orders]
            )

        if tps_data != []:
            distributed_tps = await distribute_percentages(tps_data)

            new_tps_data = await bingx.distribution.calculate_tp_amounts(account_id, trade_id, distributed_tps, trade_info, new_quantity, precision, keys)

        if new_order is False:


            return {"message": "Partial close successful"}, 200
        else:
            unrounded_quantity = float(new_quantity) + 0.5 * 10 ** (-int(quantity_precision))

            margin = round((unrounded_quantity * float(trade_info["entry"])) / int(trade_info["leverage"]), 0)

            await bingx.trade.send_trade(account_id, trade_id, margin, trade_info["side"], trade_info["symbol"], trade_info["leverage"], trade_info["entry"], precision, keys)

            await asyncio.gather(
                *[create_task(account_id, trade_id, order["document_id"], {
                    'sl_id': order["document_id"],
                    'sl_number': order['sl_number'],
                    'sl_value': order['sl_value'],
                    'sl_percentage': order['sl_percentage'],
                }, '/send_sl', user_type) for order in tp_sl_orders if order['executed'] == '1' and 'sl_number' in order],
                create_task(account_id, trade_id, None, new_tps_data, "/bulk_tp", user_type)
            )

        payload = {
            "data": {
                "value": percentage
            },
            "trade_id": trade_id,
            "user_id": account_id
        }

        await send_notification(payload, "/action?type=PartialClose")

        return {"message": "Partial close successful"}, 200

    except Exception as error:
        print(error)
        raise HTTPException(status_code=500, detail=str(error))


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=int(os.environ.get("PORT", 8080)))
