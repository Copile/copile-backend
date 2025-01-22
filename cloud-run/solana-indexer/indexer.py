import asyncio
import logging
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.transaction import Transaction
from solana.rpc.async_api import AsyncClient
import grpc
from jito_protos.block_engine.v1 import block_engine_pb2_grpc
from jito_protos.block_engine.v1.block_engine_pb2 import (
    GetTipAccountsRequest,
    SearcherRequest
)
from google.cloud import firestore
from google.cloud import tasks_v2
from google.cloud import logging as cloud_logging

# Setup logging
cloud_logging_client = cloud_logging.Client()
cloud_logging_client.setup_logging()

@dataclass
class TradeEvent:
    trade_id: str
    trader_id: str
    pool_address: str
    input_mint: str
    output_mint: str
    amount_in: int
    amount_out: int
    timestamp: int
    signature: str
    mev_data: Optional[Dict[str, Any]] = None

class SolanaIndexer:
    """
    Solana trade indexer with Jito MEV integration
    """
    def __init__(self,
                 rpc_url: str = "https://api.mainnet-beta.solana.com",
                 ws_url: Optional[str] = None,
                 jito_url: str = "grpc.jito.wtf:443"):
        self.rpc_url = rpc_url
        self.ws_url = ws_url or rpc_url.replace('https', 'wss')
        self.jito_url = jito_url
        self.client = AsyncClient(rpc_url, ws_url)
        self._jito_channel: Optional[grpc.aio.Channel] = None
        self._jito_stub: Optional[block_engine_pb2_grpc.BlockEngineStub] = None
        self.db = firestore.Client()
        self.task_client = tasks_v2.CloudTasksClient()
        self.subscriptions = {}
        
    async def connect_jito(self):
        """
        Connect to Jito block engine
        """
        if not self._jito_channel:
            self._jito_channel = grpc.aio.secure_channel(
                self.jito_url,
                grpc.ssl_channel_credentials()
            )
            self._jito_stub = block_engine_pb2_grpc.BlockEngineStub(self._jito_channel)
            
    async def index_trade(self, event: TradeEvent):
        """
        Index a trade event to Firestore
        """
        try:
            # Store trade data
            trade_ref = self.db.collection('trades').document(event.trade_id)
            trade_ref.set({
                'trader_id': event.trader_id,
                'pool_address': event.pool_address,
                'input_mint': event.input_mint,
                'output_mint': event.output_mint,
                'amount_in': event.amount_in,
                'amount_out': event.amount_out,
                'timestamp': event.timestamp,
                'signature': event.signature,
                'mev_data': event.mev_data
            })
            
            # Queue copy trade tasks
            await self.queue_copy_trades(event)
            
            logging.info(f"Indexed trade {event.trade_id}")
            
        except Exception as e:
            logging.error(f"Failed to index trade: {str(e)}")
            
    async def queue_copy_trades(self, event: TradeEvent):
        """
        Queue copy trade tasks for followers
        """
        try:
            # Get trader's followers
            followers = await self.get_followers(event.trader_id)
            
            # Create copy trade tasks
            for follower in followers:
                task = {
                    'http_request': {
                        'http_method': 'POST',
                        'url': 'https://solana-executor-zvakwy7kgq-as.a.run.app/copy-trade',
                        'oidc_token': {
                            'service_account_email': 'tasks-service-account@copile.iam.gserviceaccount.com'
                        },
                        'headers': {
                            'Content-Type': 'application/json'
                        },
                        'body': {
                            'trade_id': event.trade_id,
                            'trader_id': event.trader_id,
                            'follower_id': follower,
                            'input_mint': event.input_mint,
                            'output_mint': event.output_mint,
                            'amount_in': event.amount_in
                        }
                    }
                }
                
                await self.task_client.create_task(task)
                
        except Exception as e:
            logging.error(f"Failed to queue copy trades: {str(e)}")
            
    async def get_followers(self, trader_id: str) -> List[str]:
        """
        Get list of trader's followers
        """
        try:
            followers_ref = self.db.collection('followers').document(trader_id)
            followers_doc = followers_ref.get()
            return followers_doc.get('follower_ids', [])
            
        except Exception as e:
            logging.error(f"Failed to get followers: {str(e)}")
            return []
            
    async def monitor_mev_opportunities(self):
        """
        Monitor MEV opportunities via Jito
        """
        try:
            await self.connect_jito()
            
            request = GetTipAccountsRequest()
            response = await self._jito_stub.GetTipAccounts(request)
            
            # Process MEV data
            # Implementation would analyze MEV opportunities
            pass
            
        except Exception as e:
            logging.error(f"Failed to monitor MEV: {str(e)}")
            
    async def cleanup(self):
        """
        Cleanup connections
        """
        try:
            if self._jito_channel:
                await self._jito_channel.close()
            await self.client.close()
            
        except Exception as e:
            logging.error(f"Failed to cleanup: {str(e)}")
            
    async def start(self):
        """
        Start the indexer
        """
        try:
            # Start monitoring trades and MEV
            await asyncio.gather(
                self.monitor_mev_opportunities()
            )
            
        except Exception as e:
            logging.error(f"Failed to start indexer: {str(e)}")
            await self.cleanup() 