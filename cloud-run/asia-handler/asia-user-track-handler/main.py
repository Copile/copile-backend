import base64
import json
import os

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from exchanges import bybit
from exchanges.firestore_functions import get_trade_info, check_document_exists, store_tp, store_sl, check_executed_status

EXCHANGES = {
    'bybit': bybit
    # ... add other exchanges here
}

app = FastAPI()


@app.post('/send_tp')
async def send_tp(data: dict):

    trade_id = str(data['trade_id'])
    account_id = data['account_id']
    payload = data['payload']
    tp_document_id = str(data['tp_id'])
    tp_number = str(payload['tp_number'])
    tp_value = str(payload['tp_value'])
    tp_percentage = str(payload['tp_percentage'])
    tp_amount = str(payload["tp_amount"])

    trade_info = await get_trade_info(account_id, trade_id)
    exchange = trade_info["exchange"]

    document_status = await check_document_exists(account_id, trade_id, tp_document_id, "tp")

    if document_status.exists:
        if document_status.to_dict()["executed"] != "2":
            return await check_trade(account_id, trade_id, tp_document_id, payload, exchange, trade_info,"/send_tp")
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
        return await check_trade(account_id, trade_id, tp_document_id, payload, exchange, trade_info, "/send_tp")


@app.post('/send_sl')
async def send_sl(data: dict):
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
    

    trade_info = await get_trade_info(account_id, trade_id)
    exchange = trade_info["exchange"]

    document_status = await check_document_exists(account_id, trade_id, sl_document_id, "sl")

    if document_status.exists:
        if document_status.to_dict()["executed"] != "2":
            return await check_trade(account_id, trade_id, sl_document_id, payload, exchange, trade_info, "/send_sl")
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
        return await check_trade(account_id, trade_id, sl_document_id, payload, exchange, trade_info, "/send_sl")


async def check_trade(account_id, trade_id, document_id, payload, exchange, trade_info, endpoint):
    try:
        await EXCHANGES[exchange].check.check_trade(account_id, trade_id, document_id, payload, trade_info, endpoint)
        return {"message": f"Checking Limit Order for Take Profit: {trade_id}, {account_id}"}, 200

    except ConnectionError as error:
        raise HTTPException(status_code=503, detail="Connection error. Please try again later.")

    except Exception as error:
        print(error)
        raise HTTPException(status_code=500, detail=str(error))


def validate_inputs(exchange_name, params):
    """
    Validates that the required parameters are not empty or None.
    """
    if exchange_name not in EXCHANGES:
        raise ValueError(f"Exchange {exchange_name} is not supported.")

    for param in params:
        if param is None or str(param).strip() == "":
            raise ValueError("All parameters are required and cannot be empty.")

    return False

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=int(os.environ.get("PORT", 8080)))

