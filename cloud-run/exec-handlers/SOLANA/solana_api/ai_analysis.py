from typing import Dict, Any
import asyncio
from anthropic import AsyncAnthropic
from openai import AsyncOpenAI
from .config import NetworkConfig

class TradeAnalyzer:
    def __init__(self, config: NetworkConfig):
        self.config = config
        self.anthropic = AsyncAnthropic()
        self.openai = AsyncOpenAI()

    async def analyze_token_metrics(self, 
                                  token_address: str,
                                  market_cap: float,
                                  volume_24h: float) -> Dict[str, Any]:
        """
        Analyzes token metrics using both Claude and GPT-4 for consensus
        """
        analysis_prompt = f"""
        Analyze the following Solana token metrics for copy trading viability:
        Token Address: {token_address}
        Market Cap: ${market_cap:,.2f}
        24h Volume: ${volume_24h:,.2f}

        Consider:
        1. Market cap relative to minimum threshold of ${self.config.min_token_market_cap:,}
        2. 24h volume relative to minimum threshold of ${self.config.min_token_24h_volume:,}
        3. Liquidity implications for copy trading
        4. Potential manipulation risks
        
        Provide a structured analysis with a clear yes/no recommendation.
        """

        # Run both models concurrently
        claude_task = self.anthropic.messages.create(
            model=self.config.anthropic_model,
            max_tokens=1000,
            messages=[{
                "role": "user",
                "content": analysis_prompt
            }]
        )
        
        gpt_task = self.openai.chat.completions.create(
            model=self.config.openai_model,
            messages=[{
                "role": "user",
                "content": analysis_prompt
            }]
        )

        # Wait for both analyses with timeout
        try:
            claude_response, gpt_response = await asyncio.gather(
                claude_task,
                gpt_task,
                timeout=self.config.analysis_timeout
            )
            
            return {
                "claude_recommendation": claude_response.content,
                "gpt_recommendation": gpt_response.choices[0].message.content,
                "market_cap_sufficient": market_cap >= self.config.min_token_market_cap,
                "volume_sufficient": volume_24h >= self.config.min_token_24h_volume,
                "timestamp": asyncio.get_event_loop().time()
            }
            
        except asyncio.TimeoutError:
            return {
                "error": "Analysis timeout",
                "market_cap_sufficient": market_cap >= self.config.min_token_market_cap,
                "volume_sufficient": volume_24h >= self.config.min_token_24h_volume
            } 