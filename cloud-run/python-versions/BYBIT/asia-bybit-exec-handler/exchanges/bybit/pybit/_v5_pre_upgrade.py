from ._http_manager import _V5HTTPManager
from .pre_upgrade import PreUpgrade

class PreUpgradeHTTP(_V5HTTPManager):
    async def get_pre_upgrade_order_history(self, **kwargs) -> dict:
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{PreUpgrade.GET_PRE_UPGRADE_ORDER_HISTORY}",
            query=kwargs,
            auth=True,
        )

    async def get_pre_upgrade_trade_history(self, **kwargs) -> dict:
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{PreUpgrade.GET_PRE_UPGRADE_TRADE_HISTORY}",
            query=kwargs,
            auth=True,
        )

    async def get_pre_upgrade_closed_pnl(self, **kwargs) -> dict:
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{PreUpgrade.GET_PRE_UPGRADE_CLOSED_PNL}",
            query=kwargs,
            auth=True,
        )

    async def get_pre_upgrade_transaction_log(self, **kwargs) -> dict:
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{PreUpgrade.GET_PRE_UPGRADE_TRANSACTION_LOG}",
            query=kwargs,
            auth=True,
        )

    async def get_pre_upgrade_option_delivery_record(self, **kwargs) -> dict:
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{PreUpgrade.GET_PRE_UPGRADE_OPTION_DELIVERY_RECORD}",
            query=kwargs,
            auth=True,
        )

    async def get_pre_upgrade_usdc_session_settlement(self, **kwargs) -> dict:
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{PreUpgrade.GET_PRE_UPGRADE_USDC_SESSION_SETTLEMENT}",
            query=kwargs,
            auth=True,
        )
