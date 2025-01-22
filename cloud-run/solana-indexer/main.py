import os
import logging
from typing import Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from indexer import SolanaIndexer, TradeEvent
from google.cloud import logging as cloud_logging

# Setup logging
cloud_logging_client = cloud_logging.Client()
cloud_logging_client.setup_logging()

app = FastAPI(
    title="Solana Trade Indexer",
    description="Indexes Solana trades and manages copy trading with MEV protection",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize indexer
indexer = SolanaIndexer()

class IndexTradeRequest(BaseModel):
    trade_id: str = Field(..., description="Unique trade identifier")
    trader_id: str = Field(..., description="Trader's identifier")
    pool_address: str = Field(..., description="DEX pool address")
    input_mint: str = Field(..., description="Input token mint address")
    output_mint: str = Field(..., description="Output token mint address")
    amount_in: int = Field(..., description="Input amount in lamports")
    amount_out: int = Field(..., description="Output amount in lamports")
    timestamp: int = Field(..., description="Trade timestamp")
    signature: str = Field(..., description="Transaction signature")
    mev_data: Dict[str, Any] = Field(None, description="Optional MEV protection data")

@app.post("/index-trade",
         response_model=Dict[str, Any],
         tags=["Indexing"])
async def index_trade(request: IndexTradeRequest) -> Dict[str, Any]:
    """
    Index a new trade and queue copy trades for followers
    """
    try:
        logging.info(f"Indexing trade {request.trade_id} from trader {request.trader_id}")
        
        event = TradeEvent(
            trade_id=request.trade_id,
            trader_id=request.trader_id,
            pool_address=request.pool_address,
            input_mint=request.input_mint,
            output_mint=request.output_mint,
            amount_in=request.amount_in,
            amount_out=request.amount_out,
            timestamp=request.timestamp,
            signature=request.signature,
            mev_data=request.mev_data
        )
        
        await indexer.index_trade(event)
        
        return {
            "status": "success",
            "trade_id": request.trade_id,
            "message": "Trade indexed successfully"
        }
        
    except Exception as e:
        logging.error(f"Failed to index trade: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@app.get("/followers/{trader_id}",
         response_model=Dict[str, Any],
         tags=["Followers"])
async def get_followers(trader_id: str) -> Dict[str, Any]:
    """
    Get list of followers for a trader
    """
    try:
        logging.info(f"Fetching followers for trader {trader_id}")
        
        followers = await indexer.get_followers(trader_id)
        return {
            "status": "success",
            "trader_id": trader_id,
            "followers": followers
        }
        
    except Exception as e:
        logging.error(f"Failed to get followers: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@app.get("/health",
         response_model=Dict[str, str],
         tags=["System"])
async def health_check() -> Dict[str, str]:
    """
    Health check endpoint
    """
    return {"status": "healthy"}

@app.on_event("startup")
async def startup_event():
    logging.info("Starting Solana Trade Indexer")
    await indexer.start()

@app.on_event("shutdown")
async def shutdown_event():
    logging.info("Shutting down Solana Trade Indexer")
    await indexer.cleanup() 