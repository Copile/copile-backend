import os
import base58
import logging
from typing import Dict, Any, Optional, List
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from solders.keypair import Keypair
from solders.transaction import Transaction
from trade.coordinator import CopyTradeCoordinator
from google.cloud import logging as cloud_logging

# Setup logging
cloud_logging_client = cloud_logging.Client()
cloud_logging_client.setup_logging()

app = FastAPI(
    title="Solana Copy Trading Engine",
    description="AI-powered copy trading engine for Solana with MEV protection",
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

# Initialize coordinator with environment keypair
try:
    keypair = Keypair.from_bytes(
        base58.b58decode(os.getenv("SOLANA_KEYPAIR"))
    )
    coordinator = CopyTradeCoordinator(keypair)
    logging.info("Successfully initialized CopyTradeCoordinator")
except Exception as e:
    logging.error(f"Failed to initialize CopyTradeCoordinator: {str(e)}")
    raise

class CopyTradeRequest(BaseModel):
    input_mint: str = Field(..., description="Input token mint address")
    output_mint: str = Field(..., description="Output token mint address")
    amount: int = Field(..., description="Amount of input tokens (in lamports)")
    original_tx: Optional[str] = Field(None, description="Original transaction to copy (for MEV protection)")
    slippage_bps: Optional[int] = Field(100, description="Slippage tolerance in basis points")

class AnalyzeTradeRequest(BaseModel):
    token_address: str = Field(..., description="Token mint address to analyze")
    amount: int = Field(..., description="Amount of tokens to analyze")

class TokenBalanceRequest(BaseModel):
    token_mint: str = Field(..., description="Token mint address to check balance for")

@app.post("/copy-trade", 
         response_model=Dict[str, Any],
         tags=["Trading"])
async def copy_trade(request: CopyTradeRequest) -> Dict[str, Any]:
    """
    Execute a copy trade with optional MEV protection through Jupiter
    """
    try:
        logging.info(f"Received copy trade request for {request.input_mint} -> {request.output_mint}")
        
        original_tx = None
        if request.original_tx:
            original_tx = Transaction.from_string(request.original_tx)
            
        result = await coordinator.execute_copy_trade(
            input_mint=request.input_mint,
            output_mint=request.output_mint,
            amount=request.amount,
            original_tx=original_tx,
            slippage_bps=request.slippage_bps
        )
        
        if result["status"] == "error":
            logging.error(f"Copy trade failed: {result['reason']}")
            raise HTTPException(
                status_code=400,
                detail=result["reason"]
            )
            
        logging.info(f"Successfully executed copy trade: {result['signature']}")
        return result
        
    except Exception as e:
        logging.error(f"Unexpected error in copy trade: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@app.post("/analyze-trade", 
         response_model=Dict[str, Any],
         tags=["Analysis"])
async def analyze_trade(request: AnalyzeTradeRequest) -> Dict[str, Any]:
    """
    Analyze a trade opportunity before execution
    """
    try:
        logging.info(f"Analyzing trade for token {request.token_address}")
        
        result = await coordinator.analyze_trade_opportunity(
            token_address=request.token_address,
            amount=request.amount
        )
        
        if result["status"] == "error":
            logging.error(f"Trade analysis failed: {result['reason']}")
            raise HTTPException(
                status_code=400,
                detail=result["reason"]
            )
            
        logging.info("Successfully analyzed trade opportunity")
        return result
        
    except Exception as e:
        logging.error(f"Unexpected error in trade analysis: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@app.get("/token-balance/{token_mint}", 
        response_model=Dict[str, Any],
        tags=["Account"])
async def get_token_balance(token_mint: str) -> Dict[str, Any]:
    """
    Get token balance for the executor's account
    """
    try:
        logging.info(f"Fetching balance for token {token_mint}")
        
        accounts = await coordinator.jupiter.get_token_accounts(token_mint)
        return {
            "status": "success",
            "accounts": accounts
        }
        
    except Exception as e:
        logging.error(f"Failed to fetch token balance: {str(e)}")
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
    logging.info("Starting Solana Copy Trading Engine")

@app.on_event("shutdown")
async def shutdown_event():
    logging.info("Shutting down Solana Copy Trading Engine")
    await coordinator.cleanup()