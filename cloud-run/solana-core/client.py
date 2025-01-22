import asyncio
import logging
from typing import Dict, Any, Optional, List
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.transaction import Transaction
from solana.rpc.async_api import AsyncClient
from solana.rpc.commitment import Commitment
from anchorpy import Provider, Program

class SolanaClient:
    """
    Core Solana client for RPC interactions and transaction handling
    """
    def __init__(self, 
                 keypair: Keypair,
                 rpc_url: str = "https://api.mainnet-beta.solana.com",
                 ws_url: Optional[str] = None,
                 commitment: Commitment = "confirmed"):
        self.keypair = keypair
        self.rpc_url = rpc_url
        self.ws_url = ws_url or rpc_url.replace('https', 'wss')
        self.commitment = commitment
        self.client = AsyncClient(rpc_url, ws_url)
        self.provider = Provider(
            self.client,
            self.keypair,
            opts={"commitment": commitment}
        )
        
    async def get_token_balance(self, token_account: Pubkey) -> int:
        """
        Get token account balance
        """
        try:
            response = await self.client.get_token_account_balance(
                token_account,
                commitment=self.commitment
            )
            return int(response.value.amount)
        except Exception as e:
            logging.error(f"Failed to get token balance: {str(e)}")
            raise
            
    async def get_token_accounts(self, owner: Pubkey, mint: Pubkey) -> List[Pubkey]:
        """
        Get all token accounts for a specific mint owned by an address
        """
        try:
            response = await self.client.get_token_accounts_by_owner(
                owner,
                {"mint": str(mint)},
                commitment=self.commitment
            )
            return [Pubkey.from_string(acc.pubkey) for acc in response.value]
        except Exception as e:
            logging.error(f"Failed to get token accounts: {str(e)}")
            raise
            
    async def send_transaction(self, 
                             transaction: Transaction,
                             signers: Optional[List[Keypair]] = None) -> str:
        """
        Send and confirm transaction
        """
        try:
            signers = signers or [self.keypair]
            
            # Sign transaction
            for signer in signers:
                transaction.sign(signer)
                
            # Send transaction
            signature = await self.client.send_transaction(
                transaction,
                *signers,
                opts={"skip_preflight": True}
            )
            
            # Confirm transaction
            await self.client.confirm_transaction(
                signature.value,
                commitment=self.commitment
            )
            
            return str(signature.value)
            
        except Exception as e:
            logging.error(f"Failed to send transaction: {str(e)}")
            raise
            
    async def get_latest_blockhash(self) -> str:
        """
        Get latest blockhash
        """
        try:
            response = await self.client.get_latest_blockhash(
                commitment=self.commitment
            )
            return str(response.value.blockhash)
        except Exception as e:
            logging.error(f"Failed to get latest blockhash: {str(e)}")
            raise
            
    async def get_minimum_balance_for_rent_exemption(self, size: int) -> int:
        """
        Get minimum balance for rent exemption
        """
        try:
            response = await self.client.get_minimum_balance_for_rent_exemption(
                size,
                commitment=self.commitment
            )
            return response.value
        except Exception as e:
            logging.error(f"Failed to get rent exemption: {str(e)}")
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