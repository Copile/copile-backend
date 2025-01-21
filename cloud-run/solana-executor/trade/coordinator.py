from typing import Dict, Any, Optional
from solders.keypair import Keypair
from solders.transaction import Transaction
from ..protocols.jupiter.api.interface import JupiterInterface
from ..protocols.jupiter.api.jito import JitoMEV

class CopyTradeCoordinator:
    """
    Main coordinator for copy trading execution
    """
    def __init__(self, 
                 keypair: Keypair,
                 rpc_url: str = "https://api.mainnet-beta.solana.com",
                 jito_url: str = "grpc.jito.wtf:443"):
        self.keypair = keypair
        self.jupiter = JupiterInterface(keypair, rpc_url)
        self.jito = JitoMEV(keypair, jito_url)
        
    async def execute_copy_trade(self,
                               input_mint: str,
                               output_mint: str,
                               amount: int,
                               original_tx: Optional[Transaction] = None,
                               slippage_bps: int = 100) -> Dict[str, Any]:
        """
        Execute a copy trade with MEV protection
        """
        try:
            # Get Jupiter route and build swap
            route_result = await self.jupiter.execute_copy_trade(
                input_mint=input_mint,
                output_mint=output_mint,
                amount=amount,
                slippage_bps=slippage_bps
            )
            
            if route_result["status"] != "success":
                return route_result
                
            # If we have the original transaction, use Jito for MEV protection
            if original_tx:
                copy_tx = Transaction.from_string(route_result["signature"])
                mev_result = await self.jito.execute_copy_trade(
                    original_tx=original_tx,
                    copy_tx=copy_tx
                )
                
                return {
                    **route_result,
                    **mev_result
                }
                
            return route_result
            
        except Exception as e:
            return {
                "status": "error",
                "reason": str(e)
            }
            
    async def analyze_trade_opportunity(self,
                                      token_address: str,
                                      amount: int) -> Dict[str, Any]:
        """
        Analyze a trade opportunity before execution
        """
        try:
            # Get token accounts to verify balance
            accounts = await self.jupiter.get_token_accounts(token_address)
            
            # Simulate trade to check viability
            simulation = await self.jupiter.simulate_route({
                "input_mint": token_address,
                "output_mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",  # USDC
                "amount": amount,
                "slippage_bps": 100,
                "route_plan": [],
                "price_impact_pct": 0.0
            })
            
            return {
                "status": "success",
                "has_balance": len(accounts.get("accounts", [])) > 0,
                "simulation": simulation
            }
            
        except Exception as e:
            return {
                "status": "error",
                "reason": str(e)
            }
            
    async def cleanup(self):
        """
        Cleanup resources
        """
        await self.jito.close() 