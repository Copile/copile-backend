from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse
from google.cloud import tasks_v2
from google.protobuf import duration_pb2, timestamp_pb2
import json
import uuid
import os
import datetime
from utils.firestore import trader_check, get_user_keys
from trade.trade_execution import trade_execution

app = FastAPI()

async def add_task_to_queue(type, payload):
    # Create a Cloud Task payload with the Cloud Run service URL and request body
    
    client = tasks_v2.CloudTasksAsyncClient()

    parent = client.queue_path("copile", "us-central1", "processing-queue")

    # Create a Cloud Task object with the task payload and target URL
    task = {
        "http_request": {
            "http_method": tasks_v2.HttpMethod.POST,
            "url": os.environ.get('exchange') + '/' + type,
            "oidc_token": tasks_v2.OidcToken(
                service_account_email="tasks-service-account@copile.iam.gserviceaccount.com"
            ),
            "body": json.dumps(payload).encode(),
            "headers": {
                "Content-type": "application/json"
            }
        }
    }

    d = datetime.datetime.utcnow() + datetime.timedelta(seconds=6)
    timestamp = timestamp_pb2.Timestamp()
    timestamp.FromDatetime(d)
    task["schedule_time"] = timestamp

    task_name = str(uuid.uuid4())
    task["name"] = client.task_path("copile", "us-central1", 'processing-queue', task_name)

    duration = duration_pb2.Duration()
    duration.FromSeconds(900)
    task["dispatch_deadline"] = duration

    # Create the Cloud Task request with the parent queue, task and schedule time
    response = await client.create_task(request={"parent": parent, "task": task})
    return

@app.get('/test')
async def test():
    return {"message": "Hello World"}

@app.post('/submit_sl')
async def submit_sl(data: dict, traderId: str = Header(None)):
    try:
        exists = await trader_check(traderId)
        
        # Check if trader exists
        if not exists:
            return JSONResponse(status_code=400, content={ "success": False, "message": execution})
            
        data["traderId"] = traderId
        trader_exchange = data["trader_exchange"]

        keys = await get_user_keys(traderId, trader_exchange)
        
        execution = await trade_execution(keys['api_key'], keys['api_secret'], keys['api_passphrase'], "send_sl", data)

        # Add the trade to the processing queue
        #await add_task_to_queue("submitSL", data)

        return JSONResponse(status_code=200, content={"success": True, "message": execution})
    except Exception as err:
        # Log the error and return an error response
        raise HTTPException(status_code=500, detail=str(err))
    
@app.post('/cancelOrder')
async def cancel_order(data: dict, traderId: str = Header(None)):
    try:
        exists = await trader_check(traderId)
        
        # Check if trader exists
        if not exists:
            return JSONResponse(status_code=400, content={ "success": False, "message": execution})
            
        data["traderId"] = traderId
        trader_exchange = data["trader_exchange"]

        keys = await get_user_keys(traderId, trader_exchange)
        
        execution = await trade_execution(keys['api_key'], keys['api_secret'], keys['api_passphrase'], "cancel_order", data)

        # Add the trade to the processing queue
        #await add_task_to_queue("cancelOrder", data)

        return JSONResponse(status_code=200, content={"success": True, "message": execution})
    except Exception as err:
        # Log the error and return an error response
        raise HTTPException(status_code=500, detail=str(err))
    
@app.post('/cancel_all_orders')
async def cancel_all_orders(data: dict, traderId: str = Header(None)):
    try:
        exists = await trader_check(traderId)
        
        # Check if trader exists
        if not exists:
            return JSONResponse(status_code=400, content={ "success": False, "message": execution})
            
        data["traderId"] = traderId
        trader_exchange = data["trader_exchange"]

        keys = await get_user_keys(traderId, trader_exchange)
        
        execution = await trade_execution(keys['api_key'], keys['api_secret'], keys['api_passphrase'], "cancel_all_orders", data)

        # Add the trade to the processing queue
        #await add_task_to_queue("cancelAllOrders", data)

        return JSONResponse(status_code=200, content={"success": True, "message": execution})
    except Exception as err:
        # Log the error and return an error response
        raise HTTPException(status_code=500, detail=str(err))
    
@app.post('/cancel_all_tps')
async def cancel_all_tps(data: dict, traderId: str = Header(None)):
    try:
        exists = await trader_check(traderId)
        
        # Check if trader exists
        if not exists:
            return JSONResponse(status_code=400, content={ "success": False, "message": 'Trader does not exist.' })
            
        data["traderId"] = traderId
        trader_exchange = data["trader_exchange"]

        keys = await get_user_keys(traderId, trader_exchange)
        
        execution = await trade_execution(keys['api_key'], keys['api_secret'], keys['api_passphrase'], "cancel_all_tps", data)
        
        # Add the trade to the processing queue
        #await add_task_to_queue("cancelAllTPs", data)

        return JSONResponse(status_code=200, content={"success": True, "message": execution})
    except Exception as err:
        # Log the error and return an error response
        raise HTTPException(status_code=500, detail=str(err))
    
@app.post('/bulk_order')
async def bulk_order(data: dict, traderId: str = Header(None)):
    try:
        exists = await trader_check(traderId)
        
        # Check if trader exists
        if not exists:
            return JSONResponse(status_code=400, content={ "success": False, "message": execution})

        data["traderId"] = traderId
        trader_exchange = data["trader_exchange"]

        keys = await get_user_keys(traderId, trader_exchange)
        
        execution = await trade_execution(keys['api_key'], keys['api_secret'], keys['api_passphrase'], "bulk_order", data)

        # Add the trade to the processing queue
        #await add_task_to_queue("bulkOrder", data)

        return JSONResponse(status_code=200, content={"success": True, "message": execution})
    except Exception as err:
        # Log the error and return an error response
        raise HTTPException(status_code=500, detail=str(err))

@app.post('/bulk_tp')
async def bulk_tp(data: dict, traderId: str = Header(None)):
    try:
        exists = await trader_check(traderId)
        
        # Check if trader exists
        if not exists:
            return JSONResponse(status_code=400, content={ "success": False, "message": 'Trader does not exist.' })

        data["traderId"] = traderId
        trader_exchange = data["trader_exchange"]

        keys = await get_user_keys(traderId, trader_exchange)
        
        execution = await trade_execution(keys['api_key'], keys['api_secret'], keys['api_passphrase'], "bulk_tp", data)

        # Add the trade to the processing queue
        #await add_task_to_queue("bulkTP", data)

        return JSONResponse(status_code=200, content={"success": True, "message": execution})
    except Exception as err:
        # Log the error and return an error response
        raise HTTPException(status_code=500, detail=str(err))
    
@app.post('/replace_tp')
async def replace_tp(data: dict, traderId: str = Header(None)):
    try:
        exists = await trader_check(traderId)
        
        # Check if trader exists
        if not exists:
            return JSONResponse(status_code=400, content={ "success": False, "message": 'Trader does not exist.' })
            
        data["traderId"] = traderId
        trader_exchange = data["trader_exchange"]

        keys = await get_user_keys(traderId, trader_exchange)
        
        execution = await trade_execution(keys['api_key'], keys['api_secret'], keys['api_passphrase'], "replace_tp", data)

        # Add the trade to the processing queue
        #await add_task_to_queue("replaceTP", data)

        return JSONResponse(status_code=200, content={"success": True, "message": execution})
    except Exception as err:
        # Log the error and return an error response
        raise HTTPException(status_code=500, detail=str(err))

@app.post('/replace_sl')
async def replace_sl(data: dict, traderId: str = Header(None)):
    try:
        exists = await trader_check(traderId)
        
        # Check if trader exists
        if not exists:
            return JSONResponse(status_code=400, content={ "success": False, "message": 'Trader does not exist.' })
            
        data["traderId"] = traderId
        trader_exchange = data["trader_exchange"]

        keys = await get_user_keys(traderId, trader_exchange)
        
        execution = await trade_execution(keys['api_key'], keys['api_secret'], keys['api_passphrase'], "replace_sl", data)

        # Add the trade to the processing queue
        #await add_task_to_queue("replaceSL", data)

        return JSONResponse(status_code=200, content={"success": True, "message": execution})
    except Exception as err:
        # Log the error and return an error response
        raise HTTPException(status_code=500, detail=str(err))
    
@app.post('/partial_close')
async def partial_close(data: dict, traderId: str = Header(None)):
    try:
        exists = await trader_check(traderId)
        
        # Check if trader exists
        if not exists:
            return JSONResponse(status_code=400, content={ "success": False, "message": 'Trader does not exist.' })
            
        data["traderId"] = traderId
        trader_exchange = data["trader_exchange"]

        keys = await get_user_keys(traderId, trader_exchange)
        
        execution = await trade_execution(keys['api_key'], keys['api_secret'], keys['api_passphrase'], "partial_close", data)

        # Add the trade to the processing queue
        #await add_task_to_queue("partialClose", data)

        return JSONResponse(status_code=200, content={"success": True, "message": execution})
    except Exception as err:
        # Log the error and return an error response
        raise HTTPException(status_code=500, detail=str(err))
    
if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=int(os.environ.get("PORT", 8080)))