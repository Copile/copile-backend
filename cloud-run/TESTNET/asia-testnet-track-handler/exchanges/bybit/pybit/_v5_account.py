from ._http_manager import _V5HTTPManager
from .account import Account

class AccountHTTP(_V5HTTPManager):
    async def get_wallet_balance(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Account.GET_WALLET_BALANCE}",
            query=kwargs,
            auth=True,
        )

    async def upgrade_to_unified_trading_account(self, **kwargs):
        return await self._submit_request(
            method="POST",
            path=f"{self.endpoint}{Account.UPGRADE_TO_UNIFIED_ACCOUNT}",
            query=kwargs,
            auth=True,
        )

    async def get_borrow_history(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Account.GET_BORROW_HISTORY}",
            query=kwargs,
            auth=True,
        )

    async def get_collateral_info(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Account.GET_COLLATERAL_INFO}",
            query=kwargs,
            auth=True,
        )

    async def get_coin_greeks(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Account.GET_COIN_GREEKS}",
            query=kwargs,
            auth=True,
        )

    async def get_fee_rates(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Account.GET_FEE_RATE}",
            query=kwargs,
            auth=True,
        )

    async def get_account_info(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Account.GET_ACCOUNT_INFO}",
            query=kwargs,
            auth=True,
        )

    async def get_transaction_log(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Account.GET_TRANSACTION_LOG}",
            query=kwargs,
            auth=True,
        )

    async def set_margin_mode(self, **kwargs):
        return await self._submit_request(
            method="POST",
            path=f"{self.endpoint}{Account.SET_MARGIN_MODE}",
            query=kwargs,
            auth=True,
        )

    async def set_mmp(self, **kwargs):
        return await self._submit_request(
            method="POST",
            path=f"{self.endpoint}{Account.SET_MMP}",
            query=kwargs,
            auth=True,
        )

    async def reset_mmp(self, **kwargs):
        return await self._submit_request(
            method="POST",
            path=f"{self.endpoint}{Account.RESET_MMP}",
            query=kwargs,
            auth=True,
        )

    async def get_mmp_state(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Account.GET_MMP_STATE}",
            query=kwargs,
            auth=True,
        )
