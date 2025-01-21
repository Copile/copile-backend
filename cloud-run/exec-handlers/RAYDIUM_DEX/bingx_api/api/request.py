import aiohttp
import hashlib
import hmac
from urllib.parse import urlencode
import asyncio
from typing import Dict, Any, Optional, List
from solders.keypair import Keypair
from solders.transaction import Transaction
from solders.instruction import Instruction
from solana.rpc.async_api import AsyncClient
from anchorpy import Program, Provider, Wallet
from ..utils.raydium_client import (
    RaydiumPoolInfo,
    RaydiumSwapParams,
    RaydiumLiquidityParams,
    RAYDIUM_PROGRAM_ID
)

api_config = {
    "host": "open-api.bingx.com",
    "protocol": "https"
}

recv_window = 5000


# Function to fetch the current server time from BingX API
async def get_server_time():
    path = "/openApi/swap/v2/server/time"
    url = f"{api_config['protocol']}://{api_config['host']}{path}"

    conn = aiohttp.TCPConnector(ssl=True)
    async with aiohttp.ClientSession(connector=conn) as session:
        async with session.get(url) as response:
            data = await response.json()
            server_time = data['data']['serverTime']
            print(server_time)
            return server_time


# Function to create signature for request based on payload
def sign_request(params, api_secret):
    encoded_params = urlencode(params)
    signature = hmac.new(api_secret.encode(), encoded_params.encode(), hashlib.sha256).hexdigest()
    return signature


# Function to send the request to BingX
async def make_signed_request(method, path, payload, api_key, api_secret):
    payload['timestamp'] = await get_server_time()

    params = payload.copy()
    signature = sign_request(params, api_secret)
    params['signature'] = signature

    url = f"{api_config['protocol']}://{api_config['host']}{path}?{urlencode(params)}"
    headers = {"X-BX-APIKEY": api_key}

    conn = aiohttp.TCPConnector(ssl=True)
    async with aiohttp.ClientSession(connector=conn) as session:
        async with session.request(method, url, headers=headers) as response:
            if response.status != 200:
                raise Exception(f"Failed to send BingX API request to {path}: {response.reason}")
            data = await response.json()
            return data['data']


class RaydiumDEXClient:
    def __init__(self, keypair: Keypair, rpc_url: str = "https://api.mainnet-beta.solana.com"):
        self.keypair = keypair
        self.provider = Provider(
            AsyncClient(rpc_url),
            Wallet(keypair)
        )
        
    async def get_pool_info(self, pool_id: str) -> RaydiumPoolInfo:
        """
        Fetch pool information from Raydium
        """
        try:
            # Implementation would fetch pool info from Raydium
            # This is a placeholder that would need real implementation
            return RaydiumPoolInfo(
                id=pool_id,
                token_a_mint="",
                token_b_mint="",
                token_a_decimals=0,
                token_b_decimals=0,
                fee_rate=0,
                total_liquidity=0
            )
        except Exception as e:
            raise Exception(f"Failed to get pool info: {str(e)}")

    async def create_swap_transaction(self, 
                                    params: RaydiumSwapParams) -> Transaction:
        """
        Create swap transaction for Raydium
        """
        try:
            # Implementation would build Raydium swap transaction
            # This is a placeholder that would need real implementation
            return Transaction()
        except Exception as e:
            raise Exception(f"Failed to create swap transaction: {str(e)}")

    async def execute_swap(self,
                         pool_id: str,
                         input_token: str,
                         output_token: str,
                         amount: int,
                         slippage_bps: int = 100) -> Dict[str, Any]:
        """
        Execute a token swap through Raydium
        """
        pool_info = await self.get_pool_info(pool_id)
        
        swap_params = RaydiumSwapParams(
            pool_id=pool_id,
            input_token=input_token,
            output_token=output_token,
            amount=amount,
            slippage_bps=slippage_bps
        )
        
        transaction = await self.create_swap_transaction(swap_params)
        
        try:
            # Sign and send transaction
            # This is a placeholder that would need real implementation
            return {
                "status": "success",
                "signature": str(transaction.signatures[0]),
                "input_amount": amount,
                "output_amount": 0,  # Would be actual output amount
                "fee": pool_info.fee_rate * amount
            }
        except Exception as e:
            raise Exception(f"Failed to execute swap: {str(e)}")

    async def add_liquidity(self,
                          params: RaydiumLiquidityParams) -> Dict[str, Any]:
        """
        Add liquidity to a Raydium pool
        """
        try:
            # Implementation would add liquidity to pool
            # This is a placeholder that would need real implementation
            return {
                "status": "success",
                "signature": "",
                "pool_tokens_received": 0
            }
        except Exception as e:
            raise Exception(f"Failed to add liquidity: {str(e)}")

    async def remove_liquidity(self,
                             pool_id: str,
                             lp_amount: int) -> Dict[str, Any]:
        """
        Remove liquidity from a Raydium pool
        """
        try:
            # Implementation would remove liquidity from pool
            # This is a placeholder that would need real implementation
            return {
                "status": "success",
                "signature": "",
                "token_a_amount": 0,
                "token_b_amount": 0
            }
        except Exception as e:
            raise Exception(f"Failed to remove liquidity: {str(e)}")
