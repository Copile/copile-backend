from fastapi import FastAPI, Header, HTTPException, status
from fastapi.responses import JSONResponse
import os
from utils.firestore import get_user_keys
from .bingx_api.api.session import BingXSession

app = FastAPI()

@app.post('/submit_sl')
async def submit_sl(data: dict, traderId: str = Header(None)):
    try:

        data["traderId"] = traderId
        exchange = data["exchange"]

        keys = await get_user_keys(traderId, exchange)

        session = BingXSession(keys['api_key'], keys['api_secret'])

        execution = await session.send_sl(data)

        return JSONResponse(status_code=200, content={"success": True, "message": execution})
    except Exception as err:
        # Log the error and return an error response
        print(err)
        raise HTTPException(status_code=500, detail=str(err))


@app.post('/cancel_order')
async def cancel_order(data: dict, traderId: str = Header(None)):
    try:
        data["traderId"] = traderId
        exchange = data["exchange"]

        keys = await get_user_keys(traderId, exchange)

        session = BingXSession(keys['api_key'], keys['api_secret'])

        execution = await session.cancel_order(data)

        return JSONResponse(status_code=200, content={"success": True, "message": execution})
    except Exception as err:
        # Log the error and return an error response
        print(err)
        raise HTTPException(status_code=500, detail=str(err))


@app.post('/cancel_all_orders')
async def cancel_all_orders(data: dict, traderId: str = Header(None)):
    try:
        data["traderId"] = traderId
        exchange = data["exchange"]

        keys = await get_user_keys(traderId, exchange)

        session = BingXSession(keys['api_key'], keys['api_secret'])

        execution = await session.cancel_all_orders(data)

        return JSONResponse(status_code=200, content={"success": True, "message": execution})
    except Exception as err:
        # Log the error and return an error response
        print(err)
        raise HTTPException(status_code=500, detail=str(err))


@app.post('/cancel_all_tps')
async def cancel_all_tps(data: dict, traderId: str = Header(None)):
    try:

        data["traderId"] = traderId
        exchange = data["exchange"]

        keys = await get_user_keys(traderId, exchange)

        session = BingXSession(keys['api_key'], keys['api_secret'])

        execution = await session.cancel_all_tps(data)

        return JSONResponse(status_code=200, content={"success": True, "message": execution})
    except Exception as err:
        # Log the error and return an error response
        print(err)
        raise HTTPException(status_code=500, detail=str(err))


@app.post('/bulk_order')
async def bulk_order(data: dict, traderId: str = Header(None)):
    try:

        data["traderId"] = traderId
        exchange = data["exchange"]

        keys = await get_user_keys(traderId, exchange)

        session = BingXSession(keys['api_key'], keys['api_secret'])

        execution = await session.bulk_order(data)

        return JSONResponse(status_code=200, content={"success": True, "message": execution})
    except Exception as err:
        # Log the error and return an error response
        print(err)
        raise HTTPException(status_code=500, detail=str(err))


@app.post('/bulk_tp')
async def bulk_tp(data: dict, traderId: str = Header(None)):
    try:

        data["traderId"] = traderId
        exchange = data["exchange"]

        keys = await get_user_keys(traderId, exchange)

        session = BingXSession(keys['api_key'], keys['api_secret'])

        execution = await session.bulk_tp(data)

        return JSONResponse(status_code=200, content={"success": True, "message": execution})
    except Exception as err:
        # Log the error and return an error response
        print(err)
        raise HTTPException(status_code=500, detail=str(err))


@app.post('/replace_sl')
async def replace_sl(data: dict, traderId: str = Header(None)):
    try:

        data["traderId"] = traderId
        exchange = data["exchange"]

        keys = await get_user_keys(traderId, exchange)

        session = BingXSession(keys['api_key'], keys['api_secret'])

        execution = await session.replace_sl(data)

        return JSONResponse(status_code=200, content={"success": True, "message": execution})

    except Exception as err:
        # Log the error and return an error response
        print(err)
        raise HTTPException(status_code=500, detail=str(err))


@app.post('/partial_close')
async def partial_close(data: dict, traderId: str = Header(None)):
    try:

        data["traderId"] = traderId
        exchange = data["exchange"]

        keys = await get_user_keys(traderId, exchange)

        session = BingXSession(keys['api_key'], keys['api_secret'])

        execution = await session.partial_close(data)

        return JSONResponse(status_code=200, content={"success": True, "message": execution})
    except Exception as err:
        # Log the error and return an error response
        print(err)
        raise HTTPException(status_code=500, detail=str(err))


if __name__ == '__main__':
    import uvicorn

    uvicorn.run(app, host='0.0.0.0', port=int(os.environ.get("PORT", 8080)))
