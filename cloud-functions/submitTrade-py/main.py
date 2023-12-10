from google.cloud import tasks_v2
from google.protobuf import duration_pb2, timestamp_pb2
from fastapi import FastAPI, Header, HTTPException, status
from fastapi.responses import JSONResponse
import json
import uuid
import os
import datetime
from .utils.firestore import trader_check, get_user_keys
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
    print("Created task {}".format(response.name))
    return
    
@app.post('/submitSL')
async def submit_sl(data: dict, traderId: Optional[str] = Header(None), status_code=200):
    try:
        exists = await trader_check(traderId)
        
        # Check if trader exists
        if not exists:
            return JSONResponse(status_code=400, content={ "success": False, "message": 'Trader does not exist.' })
            
        data["traderId"] = traderId
        trader_exchange = data["trader_exchange"]

        keys = await get_user_keys(traderId, trader_exchange)
        
        execution = await trade_execution(keys['api_key'], keys['api_secret'], keys['api_passphrase'], "replaceSl", data)

        # Add the trade to the processing queue
        await add_task_to_queue("submitSL", data)

        return JSONResponse(status_code=200, content={"success": True, "message": 'Stop-loss submitted successfully.'})
    except Exception as err:
        # Log the error and return an error response
        print(err)
        raise HTTPException(status_code=500, detail=str(err))
    
@app.post('/cancelOrder')
async def cancel_order(data: dict, traderId: Optional[str] = Header(None), status_code=200):
    try:
        exists = await trader_check(traderId)
        
        # Check if trader exists
        if not exists:
            return JSONResponse(status_code=400, content={ "success": False, "message": 'Trader does not exist.' })
            
        data["traderId"] = traderId
        trader_exchange = data["trader_exchange"]

        keys = await get_user_keys(traderId, trader_exchange)
        
        execution = await trade_execution(keys['api_key'], keys['api_secret'], keys['api_passphrase'], "replaceSl", data)

        # Add the trade to the processing queue
        await add_task_to_queue("cancelOrder", trade_data)

        return JSONResponse(status_code=200, content={"success": True, "message": 'Order cancel submitted successfully.'})
    except Exception as err:
        # Log the error and return an error response
        print(err)
        raise HTTPException(status_code=500, detail=str(err))
    
@app.post('/cancelAllOrders')
async def cancel_all_orders(data: dict, traderId: Optional[str] = Header(None), status_code=200):
    try:
        exists = await trader_check(traderId)
        
        # Check if trader exists
        if not exists:
            return JSONResponse(status_code=400, content={ "success": False, "message": 'Trader does not exist.' })
            
        data["traderId"] = traderId
        trader_exchange = data["trader_exchange"]

        keys = await get_user_keys(traderId, trader_exchange)
        
        execution = await trade_execution(keys['api_key'], keys['api_secret'], keys['api_passphrase'], "replaceSl", data)

        # Add the trade to the processing queue
        await add_task_to_queue("cancelAllOrders", data)

        return JSONResponse(status_code=200, content={"success": True, "message": 'orders cancel submitted successfully.'})
    except Exception as err:
        # Log the error and return an error response
        print(err)
        raise HTTPException(status_code=500, detail=str(err))
    
@app.post('/cancelAllTPs')
async def cancel_all_tps(data: dict, traderId: Optional[str] = Header(None), status_code=200):
    try:
        exists = await trader_check(traderId)
        
        # Check if trader exists
        if not exists:
            return JSONResponse(status_code=400, content={ "success": False, "message": 'Trader does not exist.' })
            
        data["traderId"] = traderId
        trader_exchange = data["trader_exchange"]

        keys = await get_user_keys(traderId, trader_exchange)
        
        execution = await trade_execution(keys['api_key'], keys['api_secret'], keys['api_passphrase'], "replaceSl", data)
        
        # Add the trade to the processing queue
        await add_task_to_queue("cancelAllTPs", data)

        return JSONResponse(status_code=200, content={"success": True, "message": 'orders cancel submitted successfully.'})
    except Exception as err:
        # Log the error and return an error response
        print(err)
        raise HTTPException(status_code=500, detail=str(err))
    
@app.post('/bulkOrder')
async def bulk_order(data: dict, traderId: Optional[str] = Header(None), status_code=200):
    try:
        exists = await trader_check(traderId)
        
        # Check if trader exists
        if not exists:
            return JSONResponse(status_code=400, content={ "success": False, "message": 'Trader does not exist.' })

        data["traderId"] = traderId
        trader_exchange = data["trader_exchange"]

        keys = await get_user_keys(traderId, trader_exchange)
        
        execution = await trade_execution(keys['api_key'], keys['api_secret'], keys['api_passphrase'], "bulkOrder", data)

        # Add the trade to the processing queue
        await add_task_to_queue("bulkOrder", data)

        return JSONResponse(status_code=200, content={"success": True, "message": 'Trade submitted successfully.'})
    except Exception as err:
        # Log the error and return an error response
        print(err)
        raise HTTPException(status_code=500, detail=str(err))

@app.post('/bulkTP')
async def bulk_tp(data: dict, traderId: Optional[str] = Header(None), status_code=200):
    try:
        exists = await trader_check(traderId)
        
        # Check if trader exists
        if not exists:
            return JSONResponse(status_code=400, content={ "success": False, "message": 'Trader does not exist.' })

        data["traderId"] = traderId
        trader_exchange = data["trader_exchange"]

        # Add the trade to the processing queue
        await add_task_to_queue("bulkTP", data)

        return JSONResponse(status_code=200, content={"success": True, "message": 'Trade submitted successfully.'})
    except Exception as err:
        # Log the error and return an error response
        print(err)
        raise HTTPException(status_code=500, detail=str(err))
    
@app.post('/replaceTP')
async def replace_tp(data: dict, traderId: Optional[str] = Header(None), status_code=200):
    try:
        exists = await trader_check(traderId)
        
        # Check if trader exists
        if not exists:
            return JSONResponse(status_code=400, content={ "success": False, "message": 'Trader does not exist.' })
            
        trade_data = data

        trade_data["traderId"] = traderId

        # Add the trade to the processing queue
        await add_task_to_queue("replaceTP", trade_data)

        return JSONResponse(status_code=200, content={"success": True, "message": 'Trade replacement submitted successfully.'})
    except Exception as err:
        # Log the error and return an error response
        print(err)
        raise HTTPException(status_code=500, detail=str(err))

@app.post('/replaceSL')
async def replace_sl(data: dict, traderId: Optional[str] = Header(None), status_code=200):
    try:
        exists = await trader_check(traderId)
        
        # Check if trader exists
        if not exists:
            return JSONResponse(status_code=400, content={ "success": False, "message": 'Trader does not exist.' })
            
        data["traderId"] = traderId
        trader_exchange = data["trader_exchange"]

        keys = await get_user_keys(traderId, trader_exchange)
        
        execution = await trade_execution(keys['api_key'], keys['api_secret'], keys['api_passphrase'], "replaceSl", data)

        # Add the trade to the processing queue
        await add_task_to_queue("replaceSL", data)

        return JSONResponse(status_code=200, content={"success": True, "message": 'Trade replacement submitted successfully.'})
    except Exception as err:
        # Log the error and return an error response
        print(err)
        raise HTTPException(status_code=500, detail=str(err))
    
@app.post('/partialClose')
async def partial_close(data: dict, traderId: Optional[str] = Header(None), status_code=200):
    try:
        exists = await trader_check(traderId)
        
        # Check if trader exists
        if not exists:
            return JSONResponse(status_code=400, content={ "success": False, "message": 'Trader does not exist.' })
            
        data["traderId"] = traderId
        trader_exchange = data["trader_exchange"]

        keys = await get_user_keys(traderId, trader_exchange)
        
        execution = await trade_execution(keys['api_key'], keys['api_secret'], keys['api_passphrase'], "replaceSl", data)

        # Add the trade to the processing queue
        await add_task_to_queue("partialClose", data)

        return JSONResponse(status_code=200, content={"success": True, "message": 'Order part closed successfully.'})
    except Exception as err:
        # Log the error and return an error response
        print(err)
        raise HTTPException(status_code=500, detail=str(err))
    
if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=int(os.environ.get("PORT", 8080)))