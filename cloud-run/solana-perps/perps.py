import asyncio
import logging
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.transaction import Transaction
from solders.instruction import Instruction
from anchorpy import Program, Provider
import sys
import os

# Add parent directory to path for relative imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from solana_core.client import SolanaClient

@dataclass
class Position:
    market: Pubkey
    owner: Pubkey
    side: str  # 'long' or 'short'
    size: float
    entry_price: float
    leverage: float
    collateral: int
    unrealized_pnl: float
    liquidation_price: float
    last_funding_rate: float

@dataclass
class Market:
    address: Pubkey
    base_mint: Pubkey
    quote_mint: Pubkey
    oracle: Pubkey
    mark_price: float
    index_price: float
    funding_rate: float
    open_interest: float
    total_collateral: int
    max_leverage: float

class PerpetualClient:
    """
    Client for interacting with perpetual futures markets
    """
    def __init__(self,
                 solana_client: SolanaClient,
                 program_id: Pubkey):
        self.client = solana_client
        self.program_id = program_id
        self.provider = solana_client.provider
        
    async def get_market(self, market_address: Pubkey) -> Market:
        """
        Get current state of a perpetual market
        """
        try:
            account = await self.client.client.get_account_info(market_address)
            if not account:
                raise Exception(f"Market {market_address} not found")
                
            # Parse market data
            # Implementation would decode market account data
            pass
            
        except Exception as e:
            logging.error(f"Failed to get market state: {str(e)}")
            raise
            
    async def get_position(self,
                          market_address: Pubkey,
                          owner: Pubkey) -> Optional[Position]:
        """
        Get user's position in a market
        """
        try:
            # Find position PDA
            # Implementation would find and decode position account
            pass
            
        except Exception as e:
            logging.error(f"Failed to get position: {str(e)}")
            raise
            
    async def open_position(self,
                          market_address: Pubkey,
                          side: str,
                          size: float,
                          leverage: float,
                          slippage_bps: int = 50) -> str:
        """
        Open a new perpetual position
        """
        try:
            market = await self.get_market(market_address)
            
            # Calculate required collateral
            collateral = int(size * market.mark_price / leverage)
            
            # Calculate liquidation price
            maintenance_margin = 0.05  # 5%
            if side == 'long':
                liquidation_price = market.mark_price * (1 - (1 - maintenance_margin) * leverage)
            else:
                liquidation_price = market.mark_price * (1 + (1 - maintenance_margin) * leverage)
                
            # Build open position instruction
            # Implementation would build actual open position instruction
            pass
            
        except Exception as e:
            logging.error(f"Failed to open position: {str(e)}")
            raise
            
    async def close_position(self,
                           market_address: Pubkey,
                           slippage_bps: int = 50) -> str:
        """
        Close an existing position
        """
        try:
            position = await self.get_position(
                market_address,
                self.client.keypair.pubkey()
            )
            
            if not position:
                raise Exception("No position found")
                
            # Build close position instruction
            # Implementation would build actual close position instruction
            pass
            
        except Exception as e:
            logging.error(f"Failed to close position: {str(e)}")
            raise
            
    async def adjust_leverage(self,
                            market_address: Pubkey,
                            new_leverage: float) -> str:
        """
        Adjust position leverage
        """
        try:
            position = await self.get_position(
                market_address,
                self.client.keypair.pubkey()
            )
            
            if not position:
                raise Exception("No position found")
                
            market = await self.get_market(market_address)
            if new_leverage > market.max_leverage:
                raise Exception(f"Leverage exceeds maximum of {market.max_leverage}x")
                
            # Build adjust leverage instruction
            # Implementation would build actual adjust leverage instruction
            pass
            
        except Exception as e:
            logging.error(f"Failed to adjust leverage: {str(e)}")
            raise
            
    async def add_collateral(self,
                           market_address: Pubkey,
                           amount: int) -> str:
        """
        Add collateral to position
        """
        try:
            position = await self.get_position(
                market_address,
                self.client.keypair.pubkey()
            )
            
            if not position:
                raise Exception("No position found")
                
            # Build add collateral instruction
            # Implementation would build actual add collateral instruction
            pass
            
        except Exception as e:
            logging.error(f"Failed to add collateral: {str(e)}")
            raise
            
    async def remove_collateral(self,
                              market_address: Pubkey,
                              amount: int) -> str:
        """
        Remove collateral from position
        """
        try:
            position = await self.get_position(
                market_address,
                self.client.keypair.pubkey()
            )
            
            if not position:
                raise Exception("No position found")
                
            # Check if removal would cause liquidation
            new_collateral = position.collateral - amount
            min_collateral = abs(position.size * position.entry_price) / position.leverage * 0.05
            
            if new_collateral < min_collateral:
                raise Exception("Collateral removal would cause liquidation")
                
            # Build remove collateral instruction
            # Implementation would build actual remove collateral instruction
            pass
            
        except Exception as e:
            logging.error(f"Failed to remove collateral: {str(e)}")
            raise 