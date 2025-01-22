import asyncio
import logging
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.transaction import Transaction
from solana.rpc.async_api import AsyncClient
import aiohttp
import base58

@dataclass
class Route:
    input_mint: str
    output_mint: str
    amount: int
    slippage_bps: int
    platform_fee_bps: Optional[int] = None
    route_plan: Optional[List[Dict[str, Any]]] = None

class JupiterClient:
    """
    Jupiter DEX aggregator client for optimal routing and swaps
    """
    def __init__(self,
                 keypair: Keypair,
                 rpc_url: str = "https://api.mainnet-beta.solana.com"):
        self.keypair = keypair
        self.rpc_url = rpc_url
        self.client = AsyncClient(rpc_url)
        self.jupiter_api = "https://quote-api.jup.ag/v6"
        
    async def get_quote(self,
                       input_mint: str,
                       output_mint: str,
                       amount: int,
                       slippage_bps: int = 50) -> Dict[str, Any]:
        """
        Get quote for a swap through Jupiter
        """
        try:
            params = {
                "inputMint": input_mint,
                "outputMint": output_mint,
                "amount": str(amount),
                "slippageBps": slippage_bps,
                "platformFeeBps": 0
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.jupiter_api}/quote", params=params) as response:
                    if response.status != 200:
                        raise Exception(f"Failed to get quote: {response.reason}")
                    return await response.json()
                    
        except Exception as e:
            logging.error(f"Failed to get quote: {str(e)}")
            raise
            
    async def get_swap_instructions(self,
                                  route: Route) -> Transaction:
        """
        Get swap instructions for a route
        """
        try:
            # Get quote first
            quote = await self.get_quote(
                route.input_mint,
                route.output_mint,
                route.amount,
                route.slippage_bps
            )
            
            # Get swap instructions
            payload = {
                "quoteResponse": quote,
                "userPublicKey": str(self.keypair.pubkey()),
                "wrapAndUnwrapSol": True
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(f"{self.jupiter_api}/swap-instructions", json=payload) as response:
                    if response.status != 200:
                        raise Exception(f"Failed to get swap instructions: {response.reason}")
                    swap_data = await response.json()
                    
                    # Convert to Transaction
                    return Transaction.from_bytes(base58.b58decode(swap_data["swapTransaction"]))
                    
        except Exception as e:
            logging.error(f"Failed to get swap instructions: {str(e)}")
            raise
            
    async def execute_swap(self, route: Route) -> str:
        """
        Execute a swap through Jupiter
        """
        try:
            # Get swap transaction
            transaction = await self.get_swap_instructions(route)
            
            # Sign and send transaction
            transaction.sign(self.keypair)
            signature = await self.client.send_transaction(
                transaction,
                self.keypair,
                opts={"skip_preflight": True}
            )
            
            # Confirm transaction
            await self.client.confirm_transaction(
                signature.value,
                commitment="confirmed"
            )
            
            return str(signature.value)
            
        except Exception as e:
            logging.error(f"Failed to execute swap: {str(e)}")
            raise
            
    async def cleanup(self):
        """
        Cleanup connections
        """
        try:
            await self.client.close()
        except Exception as e:
            logging.error(f"Failed to cleanup: {str(e)}")
            raise 