from dataclasses import dataclass
from typing import Optional
from solders.pubkey import Pubkey

# Raydium v4 program ID
RAYDIUM_PROGRAM_ID = Pubkey.from_string("9rpQHSyFVM1dkkHFQ2TtTzPEW7DVmEyPmN8wVniqJtuC")

@dataclass
class RaydiumPoolInfo:
    id: str
    token_a_mint: str
    token_b_mint: str
    token_a_decimals: int
    token_b_decimals: int
    fee_rate: float
    total_liquidity: int
    
    @property
    def pubkey(self) -> Pubkey:
        return Pubkey.from_string(self.id)

@dataclass
class RaydiumSwapParams:
    pool_id: str
    input_token: str
    output_token: str
    amount: int
    slippage_bps: int = 100
    
    @property
    def pool_pubkey(self) -> Pubkey:
        return Pubkey.from_string(self.pool_id)
    
    @property
    def input_token_pubkey(self) -> Pubkey:
        return Pubkey.from_string(self.input_token)
    
    @property
    def output_token_pubkey(self) -> Pubkey:
        return Pubkey.from_string(self.output_token)

@dataclass
class RaydiumLiquidityParams:
    pool_id: str
    token_a_amount: int
    token_b_amount: int
    slippage_bps: int = 100
    
    @property
    def pool_pubkey(self) -> Pubkey:
        return Pubkey.from_string(self.pool_id)

# Common Raydium pool addresses
POOLS = {
    "SOL-USDC": "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2",
    "RAY-USDC": "6UmmUiYoBjSrhakAobJw8BvkmJtDVxaeBtbt7rxWo1mg",
    "RAY-SOL": "AVs9TA4nWDzfPJE9gGVNJMVhcQy3V9PGazuz33BfG2RA",
    "mSOL-SOL": "29cdoMgu6MS2VXpcMo1sqRdWEzdUR9tjvoh8fcK8Z87R",
    "USDT-USDC": "J7RCd8HhDryS5p1UPzUJCQqrdH8emV2Pr5cKvtHE5H3g",
} 