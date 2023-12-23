import os
import logging
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from utils.firestore import get_user_keys
from .binance_api.api.session import BinanceSession

logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s]: %(message)s'
)

app = FastAPI()

logger = logging.getLogger(__name__)

@app.get('/test')
async def test():
    return {"message": "Hello World"}

@app.post('/send_sl')
async def send_sl(data: dict):
    try:

        exchange = data["exchange"]
        user_id = data['user_id']

        keys = await get_user_keys(user_id, exchange)

        session = BinanceSession(keys['api_key'], keys['api_secret'])

        execution = await session.send_sl(data)

        return JSONResponse(status_code=200, content={"success": True, "message": execution})
    except Exception as e:
        # Log the error and return an error response
        logger.error(f"An error occurred for {user_id} in send_sl: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/cancel_order')
async def cancel_order(data: dict):
    try:
        exchange = data["exchange"]
        user_id = data['user_id']

        keys = await get_user_keys(user_id, exchange)

        session = BinanceSession(keys['api_key'], keys['api_secret'])

        execution = await session.cancel_order(data)

        return JSONResponse(status_code=200, content={"success": True, "message": execution})
    except Exception as e:
        # Log the error and return an error response
        logger.error(f"An error occurred for {user_id} in cancel_order: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/cancel_all_orders')
async def cancel_all_orders(data: dict):
    try:
        exchange = data["exchange"]
        user_id = data['user_id']

        keys = await get_user_keys(user_id, exchange)

        session = BinanceSession(keys['api_key'], keys['api_secret'])

        execution = await session.cancel_all_orders(data)

        return JSONResponse(status_code=200, content={"success": True, "message": execution})
    except Exception as e:
        # Log the error and return an error response
        logger.error(f"An error occurred for {user_id} in cancel_all_orders: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/cancel_all_tps')
async def cancel_all_tps(data: dict):
    try:

        exchange = data["exchange"]
        user_id = data['user_id']

        keys = await get_user_keys(user_id, exchange)

        session = BinanceSession(keys['api_key'], keys['api_secret'])

        execution = await session.cancel_all_tps(data)

        return JSONResponse(status_code=200, content={"success": True, "message": execution})
    except Exception as e:
        # Log the error and return an error response
        logger.error(f"An error occurred for {user_id} in cancel_all_tps: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/bulk_order')
async def bulk_order(data: dict):
    try:

        exchange = data["exchange"]
        user_id = data['user_id']

        keys = await get_user_keys(user_id, exchange)

        session = BinanceSession(keys['api_key'], keys['api_secret'])

        execution = await session.bulk_order(data)

        return JSONResponse(status_code=200, content={"success": True, "message": execution})
    except Exception as e:
        # Log the error and return an error response
        logger.error(f"An error occurred for {user_id} in bulk_order: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/bulk_tp')
async def bulk_tp(data: dict):
    try:

        exchange = data["exchange"]
        user_id = data['user_id']

        keys = await get_user_keys(user_id, exchange)

        session = BinanceSession(keys['api_key'], keys['api_secret'])

        execution = await session.bulk_tp(data)

        return JSONResponse(status_code=200, content={"success": True, "message": execution})
    except Exception as e:
        # Log the error and return an error response
        logger.error(f"An error occurred for {user_id} in bulk_tp: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/replace_sl')
async def replace_sl(data: dict):
    try:

        exchange = data["exchange"]
        user_id = data['user_id']

        keys = await get_user_keys(user_id, exchange)

        session = BinanceSession(keys['api_key'], keys['api_secret'])

        execution = await session.replace_sl(data)

        return JSONResponse(status_code=200, content={"success": True, "message": execution})

    except Exception as e:
        # Log the error and return an error response
        logger.error(f"An error occurred for {user_id} in replace_sl: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/partial_close')
async def partial_close(data: dict):
    try:

        exchange = data["exchange"]
        user_id = data['user_id']

        keys = await get_user_keys(user_id, exchange)

        session = BinanceSession(keys['api_key'], keys['api_secret'])

        execution = await session.partial_close(data)

        return JSONResponse(status_code=200, content={"success": True, "message": execution})
    except Exception as e:
        # Log the error and return an error response
        logger.error(f"An error occurred for {user_id} in partial_close: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == '__main__':
    import uvicorn

    uvicorn.run(app, host='0.0.0.0', port=int(os.environ.get("PORT", 8080)))
