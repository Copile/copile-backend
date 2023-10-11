import os
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from exchanges import bybit
from exchanges.firestore_functions import get_trade_info, check_document_exists, store_tp, store_sl, change_collection
import asyncio

app = FastAPI()

@app.post('/send_tp')
async def send_tp(data: dict):
    user_type = data['user_type']
    change_collection(user_type)
    trade_id = str(data['trade_id'])
    account_id = data['account_id']
    payload = data['payload']
    tp_document_id = str(data['tp_id'])
    tp_number = str(payload['tp_number'])
    tp_value = str(payload['tp_value'])
    tp_percentage = str(payload['tp_percentage'])
    tp_amount = str(payload["tp_amount"])

    document_status, trade_info = await asyncio.gather(
        check_document_exists(account_id, trade_id, tp_document_id, "tp"),
        get_trade_info(account_id, trade_id)
    )

    exchange = trade_info["exchange"]

    if document_status.exists:
        executed = document_status.to_dict()["executed"]
        if executed == "0":
            return await check_trade(account_id, trade_id, tp_document_id, payload, exchange, trade_info,"/send_tp", user_type)
        else:
            return {"message": f"Cancelled Take-Profit Monitoring: {trade_id}, {account_id}"}, 200
    else:
        tp_dict = {
            "trade_id": trade_id,
            "tp_number": tp_number,
            "tp_value": tp_value,
            "tp_percentage": tp_percentage,
            "tp_document_id": tp_document_id,
            "tp_amount": tp_amount,
        }
        await store_tp(account_id, tp_dict)
        return await check_trade(account_id, trade_id, tp_document_id, payload, exchange, trade_info, "/send_tp", user_type)

@app.post('/bulk_tp')
async def bulk_tp(data: dict):
    user_type = data['user_type']
    change_collection(user_type)
    trade_id = str(data['trade_id'])
    account_id = data['account_id']
    take_profits = data['take_profits']

    async def process_tp_data(account_id, trade_id, tp_data):
        document_status = await check_document_exists(account_id, trade_id, str(tp_data['tp_id']), "tp")
        if document_status.exists:
            tp_data["executed"] = document_status.to_dict()["executed"]
        else:
            tp_data["executed"] = "0"
            tp_dict = {
                "trade_id": trade_id,
                "tp_number": tp_data['tp_number'],
                "tp_value": tp_data['tp_value'],
                "tp_percentage": tp_data['tp_percentage'],
                "tp_document_id": tp_data['tp_id'],
                "tp_amount": tp_data['tp_amount'],
            }
            await store_tp(account_id, tp_dict)

    tasks = [process_tp_data(account_id, trade_id, tp_data) for tp_data in take_profits]
    await asyncio.gather(*tasks)

    new_take_profits = [tp_data for tp_data in take_profits if tp_data["executed"] == "0"]

    if new_take_profits != []:
        trade_info = await get_trade_info(account_id, trade_id)
        await bybit.check.check_trades(account_id, trade_id, new_take_profits, trade_info, "/bulk_tp", user_type)
        return {"message": f"Started Take-Profits Monitoring: {trade_id}, {account_id}"}, 200
    else:
        return {"message": f"Cancelled Take-Profits Monitoring: {trade_id}, {account_id}"}, 200

@app.post('/send_sl')
async def send_sl(data: dict):
    user_type = data['user_type']
    change_collection(user_type)
    trade_id = str(data['trade_id'])
    account_id = data['account_id']
    payload = data['payload']
    sl_document_id = str(data['sl_id'])
    sl_number = str(payload['sl_number'])
    sl_value = str(payload['sl_value'])
    sl_percentage = str(payload['sl_percentage'])

    if 'sl_amount' in payload:
        sl_amount = str(payload['sl_amount'])
    else:
        payload['sl_amount'] = None

    document_status, trade_info = await asyncio.gather(
        check_document_exists(account_id, trade_id, sl_document_id, "sl"),
        get_trade_info(account_id, trade_id)
    )

    exchange = trade_info["exchange"]

    if document_status.exists:
        executed = document_status.to_dict()["executed"]
        if executed == "0":
            return await check_trade(account_id, trade_id, sl_document_id, payload, exchange, trade_info, "/send_sl", user_type)
        else:
            return {"message": f"Cancelled Stop-Loss Monitoring: {trade_id}, {account_id}"}, 200
    else:
        sl_dict = {
            "trade_id": trade_id,
            "sl_number": sl_number,
            "sl_value": sl_value,
            "sl_percentage": sl_percentage,
            "sl_document_id": sl_document_id
        }
        await store_sl(account_id, sl_dict)
        return await check_trade(account_id, trade_id, sl_document_id, payload, exchange, trade_info, "/send_sl", user_type)


async def check_trade(account_id, trade_id, document_id, payload, exchange, trade_info, endpoint, user_type):
    try:
        await bybit.check.check_trade(account_id, trade_id, document_id, payload, trade_info, endpoint, user_type)
        return {"message": f"Checking Limit Order for Take Profit: {trade_id}, {account_id}"}, 200

    except ConnectionError as error:
        raise HTTPException(status_code=503, detail="Connection error. Please try again later.")

    except Exception as error:
        print(error)
        raise HTTPException(status_code=500, detail=str(error))

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=int(os.environ.get("PORT", 8080)))

