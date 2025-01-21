import os
import base58
from typing import Dict, Any, Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from solders.keypair import Keypair
from solders.transaction import Transaction
from trade.coordinator import CopyTradeCoordinator

app = FastAPI(title="Solana Copy Trading Engine")

# Initialize coordinator with environment keypair
keypair = Keypair.from_bytes(
    base58.b58decode(os.getenv("SOLANA_KEYPAIR"))
)
coordinator = CopyTradeCoordinator(keypair)

class CopyTradeRequest(BaseModel):
    input_mint: str
    output_mint: str
    amount: int
    original_tx: Optional[str] = None
    slippage_bps: Optional[int] = 100

class AnalyzeTradeRequest(BaseModel):
    token_address: str
    amount: int

@app.post("/copy-trade")
async def copy_trade(request: CopyTradeRequest) -> Dict[str, Any]:
    """
    Execute a copy trade with optional MEV protection
    """
    try:
        original_tx = None
        if request.original_tx:
            original_tx = Transaction.from_string(request.original_tx)
            
        result = await coordinator.execute_copy_trade(
            input_mint=request.input_mint,
            output_mint=request.output_mint,
            amount=request.amount,
            original_tx=original_tx,
            slippage_bps=request.slippage_bps or 100
        )
        
        if result["status"] == "error":
            raise HTTPException(
                status_code=400,
                detail=result["reason"]
            )
            
        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@app.post("/analyze-trade")
async def analyze_trade(request: AnalyzeTradeRequest) -> Dict[str, Any]:
    """
    Analyze a trade opportunity before execution
    """
    try:
        result = await coordinator.analyze_trade_opportunity(
            token_address=request.token_address,
            amount=request.amount
        )
        
        if result["status"] == "error":
            raise HTTPException(
                status_code=400,
                detail=result["reason"]
            )
            
        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@app.on_event("shutdown")
async def shutdown_event():
    await coordinator.cleanup()