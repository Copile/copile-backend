import os
import base58
import logging
from typing import Dict, Any
import functions_framework
from flask import Request
from solders.keypair import Keypair
from google.cloud import firestore
from google.cloud import logging as cloud_logging
from orca_client.client import OrcaClient, SwapParams
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from utils.firestore import get_user_keys
from bybit_api.api.session import BybitSession

# Setup logging
cloud_logging_client = cloud_logging.Client()
cloud_logging_client.setup_logging()

# Initialize Firestore
db = firestore.Client()

# Initialize Orca client
keypair = Keypair.from_bytes(
    base58.b58decode(os.getenv("SOLANA_KEYPAIR"))
)
orca = OrcaClient(keypair)

app = FastAPI()

@app.get('/test')
async def test():
    return {"message": "Hello World"}

@app.post('/send_sl')
async def send_sl(data: dict):
    try:

        exchange = data["exchange"]
        user_id = data['user_id']

        keys = await get_user_keys(user_id, exchange)

        session = BybitSession(keys['api_key'], keys['api_secret'])

        execution = await session.send_sl(data)

        return JSONResponse(status_code=200, content={"success": True, "message": execution})
    except Exception as e:
        # Log the error and return an error response
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/cancel_order')
async def cancel_order(data: dict):
    try:
        exchange = data["exchange"]
        user_id = data['user_id']

        keys = await get_user_keys(user_id, exchange)

        session = BybitSession(keys['api_key'], keys['api_secret'])

        execution = await session.cancel_order(data)

        return JSONResponse(status_code=200, content={"success": True, "message": execution})
    except Exception as e:
        # Log the error and return an error response
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/cancel_all_orders')
async def cancel_all_orders(data: dict):
    try:
        exchange = data["exchange"]
        user_id = data['user_id']

        keys = await get_user_keys(user_id, exchange)

        session = BybitSession(keys['api_key'], keys['api_secret'])

        execution = await session.cancel_all_orders(data)

        return JSONResponse(status_code=200, content={"success": True, "message": execution})
    except Exception as e:
        # Log the error and return an error response
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/cancel_all_tps')
async def cancel_all_tps(data: dict):
    try:

        exchange = data["exchange"]
        user_id = data['user_id']

        keys = await get_user_keys(user_id, exchange)

        session = BybitSession(keys['api_key'], keys['api_secret'])

        execution = await session.cancel_all_tps(data)

        return JSONResponse(status_code=200, content={"success": True, "message": execution})
    except Exception as e:
        # Log the error and return an error response
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/bulk_order')
async def bulk_order(data: dict):
    try:

        exchange = data["exchange"]
        user_id = data['user_id']

        keys = await get_user_keys(user_id, exchange)

        session = BybitSession(keys['api_key'], keys['api_secret'])

        execution = await session.bulk_order(data)

        return JSONResponse(status_code=200, content={"success": True, "message": execution})
    except Exception as e:
        # Log the error and return an error response
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/bulk_tp')
async def bulk_tp(data: dict):
    try:

        exchange = data["exchange"]
        user_id = data['user_id']

        keys = await get_user_keys(user_id, exchange)

        session = BybitSession(keys['api_key'], keys['api_secret'])

        execution = await session.bulk_tp(data)

        return JSONResponse(status_code=200, content={"success": True, "message": execution})
    except Exception as e:
        # Log the error and return an error response
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/replace_sl')
async def replace_sl(data: dict):
    try:

        exchange = data["exchange"]
        user_id = data['user_id']

        keys = await get_user_keys(user_id, exchange)

        session = BybitSession(keys['api_key'], keys['api_secret'])

        execution = await session.replace_sl(data)

        return JSONResponse(status_code=200, content={"success": True, "message": execution})

    except Exception as e:
        # Log the error and return an error response
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/partial_close')
async def partial_close(data: dict):
    try:

        exchange = data["exchange"]
        user_id = data['user_id']

        keys = await get_user_keys(user_id, exchange)

        session = BybitSession(keys['api_key'], keys['api_secret'])

        execution = await session.partial_close(data)

        return JSONResponse(status_code=200, content={"success": True, "message": execution})
    except Exception as e:
        # Log the error and return an error response
        raise HTTPException(status_code=500, detail=str(e))


@functions_framework.http
async def handle_request(request: Request) -> Dict[str, Any]:
    """
    Handle copy trade requests for Orca DEX
    """
    try:
        # Parse request data
        data = request.get_json()
        trade_id = data.get("trade_id")
        trader_id = data.get("trader_id")
        follower_id = data.get("follower_id")
        
        logging.info(f"Processing copy trade {trade_id} from {trader_id} for {follower_id}")
        
        # Get trade details from Firestore
        trade_ref = db.collection("trades").document(trade_id)
        trade_doc = trade_ref.get()
        
        if not trade_doc.exists:
            raise Exception(f"Trade {trade_id} not found")
            
        trade_data = trade_doc.to_dict()
        
        # Get follower's copy trading settings
        follower_ref = db.collection("users").document(follower_id)
        follower_doc = follower_ref.get()
        
        if not follower_doc.exists:
            raise Exception(f"Follower {follower_id} not found")
            
        follower_data = follower_doc.to_dict()
        copy_settings = follower_data.get("copy_settings", {})
        
        # Calculate copy size based on settings
        amount_in = int(trade_data["amount_in"] * copy_settings.get("size_percentage", 1.0))
        
        # Get quote for the swap
        quote = await orca.get_quote(
            pool_address=trade_data["pool"],
            input_token=trade_data["input_token"],
            amount=amount_in
        )
        
        # Execute swap with slippage protection
        params = SwapParams(
            pool=trade_data["pool"],
            input_token=trade_data["input_token"],
            amount_in=amount_in,
            min_amount_out=int(quote["amount_out"] * (1 - copy_settings.get("slippage", 0.01)))
        )
        
        signature = await orca.swap(params)
        
        # Store copy trade result
        copy_trade_ref = db.collection("copy_trades").document()
        copy_trade_ref.set({
            "original_trade_id": trade_id,
            "trader_id": trader_id,
            "follower_id": follower_id,
            "signature": signature,
            "pool": str(trade_data["pool"]),
            "input_token": trade_data["input_token"],
            "amount_in": amount_in,
            "min_amount_out": params.min_amount_out,
            "timestamp": firestore.SERVER_TIMESTAMP
        })
        
        logging.info(f"Successfully executed copy trade: {signature}")
        
        return {
            "status": "success",
            "signature": signature,
            "message": "Copy trade executed successfully"
        }
        
    except Exception as e:
        logging.error(f"Failed to execute copy trade: {str(e)}")
        return {
            "status": "error",
            "message": str(e)
        }
        
    finally:
        await orca.cleanup()


if __name__ == '__main__':
    import uvicorn

    uvicorn.run(app, host='0.0.0.0', port=int(os.environ.get("PORT", 8080)))
