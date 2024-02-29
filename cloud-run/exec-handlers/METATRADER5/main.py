import os
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from mt5_api.session import MetaSession
from mt5_api.execution.utils.secret import access_secret_version

app = FastAPI()

@app.get('/test')
async def test():
    return {"message": "Hello World"}

@app.post('/send_sl')
async def send_sl(data: dict):
    try:

        account_id = data['user_id']

        token = access_secret_version()

        session = MetaSession(token, account_id)

        execution = await session.send_sl(data)

        return JSONResponse(status_code=200, content={"success": True, "message": execution})
    except Exception as e:
        # Log the error and return an error response
        print(e)
        raise HTTPException(status_code=500, detail=str(e))

@app.post('/send_tp')
async def send_tp(data: dict):
    try:

        account_id = data['user_id']

        token = access_secret_version()

        session = MetaSession(token, account_id)

        execution = await session.send_sl(data)

        return JSONResponse(status_code=200, content={"success": True, "message": execution})
    except Exception as e:
        # Log the error and return an error response
        print(e)
        raise HTTPException(status_code=500, detail=str(e))

@app.post('/cancel_order')
async def cancel_order(data: dict):
    try:
        account_id = data['user_id']

        token = access_secret_version()

        session = MetaSession(token, account_id)

        execution = await session.cancel_order(data)

        return JSONResponse(status_code=200, content={"success": True, "message": execution})
    except Exception as e:
        # Log the error and return an error response
        print(e)
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/cancel_all_orders')
async def cancel_all_orders(data: dict):
    try:
        account_id = data['user_id']

        token = access_secret_version()

        session = MetaSession(token, account_id)

        execution = await session.cancel_all_orders(data)

        return JSONResponse(status_code=200, content={"success": True, "message": execution})
    except Exception as e:
        # Log the error and return an error response
        print(e)
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/cancel_all_tps')
async def cancel_all_tps(data: dict):
    try:
        account_id = data['user_id']

        token = access_secret_version()

        session = MetaSession(token, account_id)

        execution = await session.cancel_all_tps(data)

        return JSONResponse(status_code=200, content={"success": True, "message": execution})
    except Exception as e:
        # Log the error and return an error response#
        print(e)
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/bulk_order')
async def bulk_order(data: dict):
    try:
        account_id = data['user_id']

        token = access_secret_version()

        session = MetaSession(token, account_id)

        execution = await session.bulk_order(data)

        return JSONResponse(status_code=200, content={"success": True, "message": execution})
    except Exception as e:
        # Log the error and return an error response
        print(e)
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/bulk_tp')
async def bulk_tp(data: dict):
    try:
        account_id = data['user_id']

        token = access_secret_version()

        session = MetaSession(token, account_id)

        execution = await session.bulk_tp(data)

        return JSONResponse(status_code=200, content={"success": True, "message": execution})
    except Exception as e:
        # Log the error and return an error response
        print(e)
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/replace_sl')
async def replace_sl(data: dict):
    try:
        account_id = data['user_id']

        token = access_secret_version()

        session = MetaSession(token, account_id)

        execution = await session.replace_sl(data)

        return JSONResponse(status_code=200, content={"success": True, "message": execution})

    except Exception as e:
        # Log the error and return an error response
        print(e)
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/partial_close')
async def partial_close(data: dict):
    try:
        account_id = data['user_id']

        token = access_secret_version()

        session = MetaSession(token, account_id)

        execution = await session.partial_close(data)

        return JSONResponse(status_code=200, content={"success": True, "message": execution})
    except Exception as e:
        # Log the error and return an error response
        print(e)
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == '__main__':
    import uvicorn

    uvicorn.run(app, host='0.0.0.0', port=int(os.environ.get("PORT", 8080)))
