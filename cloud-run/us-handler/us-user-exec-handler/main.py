import base64
import json
import os
import asyncio
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from exchanges import bingx, kucoin
from exchanges.firestore_functions import get_trade_info, get_tp_sl_orders, change_executed_status_tp_sl, delete_tp_sl_order, get_user_keys
from exchanges.create_cloud_task import create_task
from exchanges.partial import distribute_percentages

EXCHANGES = {
    'bingx': bingx,
    'kucoin': kucoin
    # ... add other exchanges here
}

app = FastAPI()


# send calls
@app.post('/send_call')
async def send_call(data: dict):
    trade_id = data['trade_id']
    account_id = data['account_id']
    payload = data['payload']
    exchange = data['exchange']
    plan_id = data['plan_id']
    side = payload['side']
    symbol = payload['symbol']
    leverage = payload['leverage']
    entry = payload['entry']
    
    keys = await get_user_keys(account_id, exchange)

    try:
        # call method to start trade
        await EXCHANGES[exchange].trade.send_trade(account_id, trade_id, plan_id, side, symbol, leverage, entry, keys)
        return {"message": f"Call sent: {trade_id}"}

    except ConnectionError as error:
        raise HTTPException(status_code=503, detail="Connection error. Please try again later.")

    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))


# send takeprofit
@app.post('/send_tp')
async def send_tp(data: dict):
    trade_id = data['trade_id']
    account_id = data['account_id']
    payload = data['payload']
    tp_document_id = data['tp_id']

    tp_number = payload['tp_number']
    tp_value = payload['tp_value']
    tp_percentage = payload['tp_percentage']
    tp_amount = payload['tp_amount']

    trade_info = await get_trade_info(account_id, trade_id)
    exchange = trade_info["exchange"]
    keys = await get_user_keys(account_id, exchange)

    try:
        # call method to sent tp
        await EXCHANGES[exchange].profit.send_profit(account_id, trade_id, tp_document_id, tp_number, tp_value,
                                                   tp_percentage, tp_amount, trade_info, keys)
        return {"message": f"Take profit sent {trade_id}"}

    except ConnectionError as error:
        raise HTTPException(status_code=503, detail="Connection error. Please try again later.")

    except Exception as error:
        print(error)
        raise HTTPException(status_code=500, detail=str(error))

@app.post('/replace_tp')
async def replace_tp(data: dict):
    trade_id = data['trade_id']
    account_id = data['account_id']
    order_id = data['document_id']
    payload = data['payload']

    trade_info = await get_trade_info(account_id, trade_id)
    exchange = trade_info["exchange"]
    keys = await get_user_keys(account_id, exchange)
    
    try:
        # Use get_order_quantity to get current quantity
        current_quantity = EXCHANGES[exchange].order.get_order_quantity(account_id, trade_id, order_id, keys)

        # Cancel the order
        EXCHANGES[exchange].cancel.send_cancel(account_id, trade_id, order_id, "tp", keys)

        # Resend the tp with the updated payload
        EXCHANGES[exchange].profit.send_profit(account_id, trade_id, payload['tp_id'], payload['tp_number'], payload['tp_value'], payload['tp_percentage'], float(current_quantity), keys)
        
        return {"message": f"Replaced take profit order for trade {trade_id}"}

    except ConnectionError as error:
        raise HTTPException(status_code=503, detail="Connection error. Please try again later.")

    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))

# send stoploss
@app.post('/send_sl')
async def send_sl(data: dict):
    trade_id = data['trade_id']
    account_id = data['account_id']
    payload = data['payload']
    sl_document_id = data['sl_id']

    sl_number = payload['sl_number']
    sl_value = payload['sl_value']
    sl_percentage = payload['sl_percentage']

    trade_info = await get_trade_info(account_id, trade_id)
    exchange = trade_info["exchange"]
    keys = await get_user_keys(account_id, exchange)

    try:
        # call method to send stop loss
        await EXCHANGES[exchange].stoploss.send_stoploss(account_id, trade_id, sl_document_id, sl_number, sl_value,
                                                   sl_percentage, None, trade_info, keys)
        return {"message": f"Stop loss sent {trade_id}"}

    except ConnectionError as error:
        raise HTTPException(status_code=503, detail="Connection error. Please try again later.")

    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))

@app.post('/replace_sl')
async def replace_sl(data: dict):
    # Load the data from the request
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
        # Fetch the current position quantity
        position_quantity = await EXCHANGES[exchange].position.get_position(account_id, trade_id, trade_info, keys)

        # Cancel the order
        await EXCHANGES[exchange].cancel.send_cancel(account_id, trade_id, order_id, "sl", trade_info, keys)

        if position_quantity != 0:
            # Resend the sl with the updated payload
            await EXCHANGES[exchange].stoploss.send_stoploss(account_id, trade_id, payload['sl_id'], payload['sl_number'], payload['sl_value'], payload['sl_percentage'], float(position_quantity), trade_info, keys)
        else:
            position_quantity = trade_info["quantity"]
            # Resend the sl with the updated payload
            await create_task(account_id, trade_id, payload["sl_id"], payload, '/send_sl')

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
        await EXCHANGES[exchange].cancel.send_cancel(account_id, trade_id, document_id, trade_type, trade_info, keys)
        return {"message": f"Cancelled order: {trade_id}"}

    except ConnectionError as error:
        raise HTTPException(status_code=503, detail="Connection error. Please try again later.")

    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))


# cancel all orders
@app.post('/cancel_all_orders')
async def cancel_all_orders(data: dict):
    trade_id = data['trade_id']
    account_id = data['account_id']
    exchange = data['exchange']

    trade_info, keys = await asyncio.gather(
        get_trade_info(account_id, trade_id),
        get_user_keys(account_id, exchange)
    )

    try:
        # call method to cancel all orders
        await EXCHANGES[exchange].emergency.send_emergency(account_id, trade_id, trade_info, keys)
        return {"message": "Cancelled all orders"}

    except ConnectionError as error:
        print(error)
        raise HTTPException(status_code=503, detail="Connection error. Please try again later.")

    except Exception as error:
        print(error)
        raise HTTPException(status_code=500, detail=str(error))

@app.post('/cancel_all_tps')
async def cancel_all_tps(data: dict):
    account_id = data['account_id']
    trade_id = data['trade_id']
    exchange = data['exchange']

    trade_info, keys = await asyncio.gather(
        get_trade_info(account_id, trade_id),
        get_user_keys(account_id, exchange)
    )

    try:
        # Fetch all take profit and stop loss orders associated with this trade
        tp_sl_orders = await get_tp_sl_orders(account_id, trade_id)

        # Filter the take profit orders
        tp_orders = [order for order in tp_sl_orders if 'tp_number' in order and order['executed'] != '2']
        print(tp_orders)
        # Prepare tasks to cancel orders and delete them from the database
        tasks = []
        for tp_order in tp_orders:
            tasks.append(EXCHANGES[exchange].cancel.send_cancel(account_id, trade_id, tp_order["document_id"], "tp", trade_info, keys))

        # Execute tasks concurrently
        await asyncio.gather(*tasks)

        return JSONResponse(content={"message": "All take profits cancelled successfully"}, status_code=200)

    except Exception as error:
        print(error)
        raise HTTPException(status_code=500, detail=str(error))

@app.post('/bulk_tp')
async def bulk_tp(data: dict):
    trade_id = data['trade_id']
    take_profits = data['take_profits']
    account_id = data['account_id']
    exchange = data['exchange']

    keys, trade_info = await asyncio.gather(
        get_user_keys(account_id, exchange),
        get_trade_info(account_id, trade_id)
    )

    try:
        position_quantity = await EXCHANGES[exchange].position.get_position(account_id, trade_id, trade_info, keys)

        new_take_profits = await EXCHANGES[exchange].distribution.calculate_tp_amounts(account_id, trade_id, take_profits, trade_info, position_quantity, keys)

        if position_quantity != 0:
            tasks = [EXCHANGES[exchange].profit.send_profit(account_id, trade_id, tp_data["tp_id"], tp_data["tp_number"], tp_data["tp_value"], tp_data["tp_percentage"], tp_data["tp_amount"], trade_info, keys) for tp_data in new_take_profits]
            await asyncio.gather(*tasks)
        else:
            # Use asyncio.gather to concurrently create tasks
            tasks = [create_task(account_id, trade_id, tp_data['tp_id'], {
                'tp_id': tp_data['tp_id'],
                'tp_number': tp_data['tp_number'],
                'tp_value': tp_data['tp_value'],
                'tp_percentage': tp_data['tp_percentage'],
                'tp_amount': tp_data['tp_amount']
            }, '/send_tp') for tp_data in new_take_profits]
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
    trade_id = data['trade_id']
    account_id = data['account_id']
    payload = data['payload']
    plan_id = data['plan_id']
    exchange = data['exchange']
    side = payload['side']
    symbol = payload['symbol']
    leverage = payload['leverage']
    entry = payload['entry']
    take_profits = payload['take_profits']
    stop_losses = payload['stop_losses']

    try:
        keys = await get_user_keys(account_id, exchange)

        trade_result = await EXCHANGES[exchange].trade.send_trade(account_id, trade_id, plan_id, side, symbol, leverage, entry, keys)

        # parallelize sending stop losses
        sl_tasks = [create_task(account_id, trade_id, sl_data["sl_id"], {
            'sl_id': sl_data["sl_id"],
            'sl_number': sl_data['sl_number'],
            'sl_value': sl_data['sl_value'],
            'sl_percentage': sl_data['sl_percentage'],
            'sl_amount': None
        }, '/send_sl') for sl_data in stop_losses]
        
        await asyncio.gather(*sl_tasks)
        
        # Calculate new take profit amounts
        if take_profits != []:

            trade_info = await get_trade_info(account_id, trade_id)

            new_tps_data = await EXCHANGES[exchange].distribution.calculate_tp_amounts(account_id, trade_id, take_profits, trade_info, float(trade_info["quantity"]), keys)

            # Parallelize sending take profits
            tp_tasks = [create_task(account_id, trade_id, tp_data["tp_id"], {
                'tp_id': tp_data["tp_id"],
                'tp_number': tp_data['tp_number'],
                'tp_value': tp_data['tp_value'],
                'tp_percentage': tp_data['tp_percentage'],
                'tp_amount': tp_data['tp_amount']
            }, '/send_tp') for tp_data in new_tps_data]
            
            await asyncio.gather(*tp_tasks)

        return {"message": "All orders placed successfully"}, 200

    except ConnectionError as error:
        print(error)
        raise HTTPException(status_code=503, detail="Connection error. Please try again later.")

    except Exception as error:
        print(error)
        raise HTTPException(status_code=500, detail=str(error))

@app.post('/partial_close')
async def partial_close(data: dict):
    account_id = data['account_id']
    trade_id = data['trade_id']
    percentage = float(data['percentage'])

    # Fetch trade details from Firestore
    trade_info = await get_trade_info(account_id, trade_id)
    exchange = trade_info['exchange']
    symbol = trade_info['symbol']
    
    keys, tp_sl_orders = await asyncio.gather(
        get_user_keys(account_id, trade_info['exchange']),
        get_tp_sl_orders(account_id, trade_id)
    )

    try:
        position_quantity, quantity_precision = await asyncio.gather(
            EXCHANGES[exchange].position.get_position(account_id, trade_id, trade_info, keys),
            EXCHANGES[exchange].precision.get_precision(account_id, symbol, keys)
        ) 

        if position_quantity == 0:
            position_quantity = float(trade_info["quantity"])

        position_quantity = float(position_quantity)

        quantity_to_sell = round(float(position_quantity) * percentage, quantity_precision)

        new_quantity = round(position_quantity - quantity_to_sell, quantity_precision)

        tps_data = []
        new_tps_data = []

        async def process_orders(order):
            tp_status = await EXCHANGES[exchange].order.get_order_status(account_id, trade_id, order["document_id"], trade_info, keys)
            order["tp_status"] = tp_status
            tps_data.append(order)

        await asyncio.gather(
            *[EXCHANGES[exchange].sell.sell_quantity(account_id, trade_id, quantity_to_sell, trade_info, keys)],
            *[process_orders(order) for order in tp_sl_orders if 'tp_number' in order],
        )

        await asyncio.gather(
            *[EXCHANGES[exchange].cancel.send_cancel(account_id, trade_id, order["document_id"], "tp", trade_info, keys) for order in tps_data if order['tp_status'] == "active"],
        )

        if tps_data != []:
            distributed_tps = await distribute_percentages(tps_data)

            new_tps_data = await EXCHANGES[exchange].distribution.calculate_tp_amounts(account_id, trade_id, distributed_tps, trade_info, new_quantity, keys)

        if position_quantity != 0:

            await asyncio.gather(
                *[EXCHANGES[exchange].cancel.send_cancel(account_id, trade_id, order["document_id"], "sl", trade_info, keys) for order in tp_sl_orders if order['executed'] == '1' and 'sl_number' in order],
                *[EXCHANGES[exchange].stoploss.send_stoploss(account_id, trade_id, order["document_id"], order['sl_number'], order["sl_value"], order["sl_percentage"], None, trade_info, keys) for order in tp_sl_orders if order['executed'] == '1' and 'sl_number' in order], 
                *[EXCHANGES[exchange].profit.send_profit(account_id, trade_id, order["tp_id"], order["tp_number"], order["tp_value"], order["tp_percentage"], order["tp_amount"], trade_info, keys) for order in new_tps_data]
            )
            
        else:

            unroundedQuantity = float(new_quantity) + 0.5 * 10 ** (-int(quantity_precision))

            margin = round((unroundedQuantity * float(trade_info["entry"])) / int(trade_info["leverage"]), 0)

            await EXCHANGES[exchange].cancel.send_cancel(account_id, trade_id, None, None, trade_info, keys)
            await EXCHANGES[exchange].trade.send_trade(account_id, trade_id, margin, trade_info["side"], trade_info["symbol"], trade_info["leverage"], trade_info["entry"], keys)

            await asyncio.gather(
                *[create_task(account_id, trade_id, order["document_id"], {
                    'sl_id': order["document_id"],
                    'sl_number': order['sl_number'],
                    'sl_value': order['sl_value'],
                    'sl_percentage': order['sl_percentage'],
                }, '/send_sl') for order in tp_sl_orders if order['executed'] == '1' and 'sl_number' in order]
            )

            await asyncio.gather(
                *[create_task(account_id, trade_id, order["tp_id"], {
                    'tp_id': order["tp_id"],
                    'tp_number': order['tp_number'],
                    'tp_value': order['tp_value'],
                    'tp_percentage': order['tp_percentage'],
                    'tp_amount': order['tp_amount']
                }, '/send_tp') for order in new_tps_data]
            )

        return {"message": "Partial close successful"}, 200

    except Exception as error:
        print(error)
        raise HTTPException(status_code=500, detail=str(error))

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=int(os.environ.get("PORT", 8080)))
