from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse

app = FastAPI()

@app.post('/newTrade')
async def new_trade(trade_data: TradeData, traderid: str = Header(None)):
    try:
        # Check if trader exists (You should implement the traderCheck function)
        #exists = await trader_check(traderid)
        if not exists:
            raise HTTPException(status_code=400, detail='Trader does not exist.')

        # Add traderId to the trade data
        trade_data.traderId = traderid

        # Add the trade to the processing queue
        #await add_task_to_queue("newTrade", trade_data, "POST")

        return {"success": True, "message": "Trade submitted successfully."}
    except Exception as err:
        # Log the error and return an error response
        print(err)
        raise HTTPException(status_code=500, detail=str(err))