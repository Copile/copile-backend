from dataclasses import dataclass
from typing import List, Optional
from solders.pubkey import Pubkey

@dataclass
class JupiterQuoteParams:
    input_mint: str
    output_mint: str
    amount: int
    slippage_bps: int = 100
    only_direct_routes: bool = False
    
@dataclass
class RouteSegment:
    input_mint: str
    output_mint: str
    protocol: str
    input_amount: int
    output_amount: int
    fee_amount: int
    fee_mint: str

@dataclass
class JupiterRoute:
    segments: List[RouteSegment]
    amount_in: int
    amount_out: int
    price_impact_pct: float
    market_impact_pct: float
    min_output_amount: int
    
@dataclass
class JupiterSwapParams:
    quote: dict
    user_public_key: Pubkey
    wrap_unwrap_sol: bool = True
    compute_unit_price: Optional[int] = None

@dataclass
class TokenInfo:
    address: str
    symbol: str
    name: str
    decimals: int
    chain_id: int = 101  # Solana mainnet
    
    @property
    def pubkey(self) -> Pubkey:
        return Pubkey.from_string(self.address)

# Common token addresses on Solana
TOKENS = {
    "SOL": TokenInfo(
        "So11111111111111111111111111111111111111112",
        "SOL",
        "Solana",
        9
    ),
    "USDC": TokenInfo(
        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        "USDC",
        "USD Coin",
        6
    ),
    "USDT": TokenInfo(
        "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
        "USDT",
        "Tether USD",
        6
    ),
    "mSOL": TokenInfo(
        "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
        "mSOL",
        "Marinade Staked SOL",
        9
    ),
    "RAY": TokenInfo(
        "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
        "RAY",
        "Raydium",
        6
    )
} 