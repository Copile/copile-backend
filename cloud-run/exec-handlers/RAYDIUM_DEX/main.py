import os
import base58
import logging
from typing import Dict, Any
import functions_framework
from flask import Request
from solders.keypair import Keypair
from google.cloud import firestore
from google.cloud import logging as cloud_logging
from raydium_client.client import RaydiumClient, SwapParams

# Setup logging
cloud_logging_client = cloud_logging.Client()
cloud_logging_client.setup_logging()

# Initialize Firestore
db = firestore.Client()

# Initialize Raydium client
keypair = Keypair.from_bytes(
    base58.b58decode(os.getenv("SOLANA_KEYPAIR"))
)
raydium = RaydiumClient(keypair)

@functions_framework.http
async def handle_request(request: Request) -> Dict[str, Any]:
    """
    Handle copy trade requests for Raydium DEX
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
        quote = await raydium.get_quote(
            pool_address=trade_data["pool"],
            input_token=trade_data["input_token"],
            amount=amount_in
        )
        
        # Execute swap with slippage protection
        params = SwapParams(
            pool=trade_data["pool"],
            amm_id=trade_data["amm_id"],
            input_token=trade_data["input_token"],
            amount_in=amount_in,
            min_amount_out=int(quote["amount_out"] * (1 - copy_settings.get("slippage", 0.01)))
        )
        
        signature = await raydium.swap(params)
        
        # Store copy trade result
        copy_trade_ref = db.collection("copy_trades").document()
        copy_trade_ref.set({
            "original_trade_id": trade_id,
            "trader_id": trader_id,
            "follower_id": follower_id,
            "signature": signature,
            "pool": str(trade_data["pool"]),
            "amm_id": str(trade_data["amm_id"]),
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
        await raydium.cleanup()
