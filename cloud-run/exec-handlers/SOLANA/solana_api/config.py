from dataclasses import dataclass
from typing import Optional
from solders.pubkey import Pubkey

@dataclass
class NetworkConfig:
    # Jito MEV-related settings
    jito_grpc_url: str = "grpc.jito.wtf:443"
    jito_auth_keypair: Optional[str] = None
    block_engine_url: str = "https://block-engine.jito.wtf"
    
    # Solana network settings
    rpc_url: str = "https://api.mainnet-beta.solana.com"
    ws_url: str = "wss://api.mainnet-beta.solana.com"
    commitment: str = "confirmed"
    
    # Copy trading settings
    max_block_delay: int = 1  # Maximum blocks to wait for copy trade
    max_trade_slippage: float = 0.005  # 0.5% max slippage
    min_token_market_cap: int = 1_000_000  # Minimum market cap in USD
    min_token_24h_volume: int = 100_000  # Minimum 24h volume in USD

    # AI Analysis settings
    anthropic_model: str = "claude-3-sonnet-20240229"
    openai_model: str = "gpt-4-turbo-preview"
    analysis_timeout: int = 2  # seconds

    # Known program IDs
    jupiter_v6_program_id: Pubkey = Pubkey.from_string("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4")
    raydium_v4_program_id: Pubkey = Pubkey.from_string("9rpQHSyFVM1dkkHFQ2TtTzPEW7DVmEyPmN8wVniqJtuC") 