from ._http_manager import _V5HTTPManager
from .asset import Asset




class AssetHTTP(_V5HTTPManager):
    async def get_coin_exchange_records(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Asset.GET_COIN_EXCHANGE_RECORDS}",
            query=kwargs,
            auth=True,
        )

    async def get_option_delivery_record(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Asset.GET_OPTION_DELIVERY_RECORD}",
            query=kwargs,
            auth=True,
        )

    async def get_usdc_contract_settlement(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Asset.GET_USDC_CONTRACT_SETTLEMENT}",
            query=kwargs,
            auth=True,
        )

    async def get_spot_asset_info(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Asset.GET_SPOT_ASSET_INFO}",
            query=kwargs,
            auth=True,
        )

    async def get_coins_balance(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Asset.GET_ALL_COINS_BALANCE}",
            query=kwargs,
            auth=True,
        )

    async def get_coin_balance(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Asset.GET_SINGLE_COIN_BALANCE}",
            query=kwargs,
            auth=True,
        )

    async def get_transferable_coin(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Asset.GET_TRANSFERABLE_COIN}",
            query=kwargs,
            auth=True,
        )

    async def create_internal_transfer(self, **kwargs):
        return await self._submit_request(
            method="POST",
            path=f"{self.endpoint}{Asset.CREATE_INTERNAL_TRANSFER}",
            query=kwargs,
            auth=True,
        )

    async def get_internal_transfer_records(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Asset.GET_INTERNAL_TRANSFER_RECORDS}",
            query=kwargs,
            auth=True,
        )

    async def get_sub_uid(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Asset.GET_SUB_UID}",
            query=kwargs,
            auth=True,
        )

    async def enable_universal_transfer_for_sub_uid(self, **kwargs):
        return await self._submit_request(
            method="POST",
            path=f"{self.endpoint}{Asset.ENABLE_UT_FOR_SUB_UID}",
            query=kwargs,
            auth=True,
        )

    async def create_universal_transfer(self, **kwargs):
        return await self._submit_request(
            method="POST",
            path=f"{self.endpoint}{Asset.CREATE_UNIVERSAL_TRANSFER}",
            query=kwargs,
            auth=True,
        )

    async def get_universal_transfer_records(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Asset.GET_UNIVERSAL_TRANSFER_RECORDS}",
            query=kwargs,
            auth=True,
        )

    async def get_allowed_deposit_coin_info(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Asset.GET_ALLOWED_DEPOSIT_COIN_INFO}",
            query=kwargs,
            auth=True,
        )

    async def set_deposit_account(self, **kwargs):
        return await self._submit_request(
            method="POST",
            path=f"{self.endpoint}{Asset.SET_DEPOSIT_ACCOUNT}",
            query=kwargs,
            auth=True,
        )

    async def get_deposit_records(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Asset.GET_DEPOSIT_RECORDS}",
            query=kwargs,
            auth=True,
        )

    async def get_sub_deposit_records(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Asset.GET_SUB_ACCOUNT_DEPOSIT_RECORDS}",
            query=kwargs,
            auth=True,
        )

    async def get_internal_deposit_records(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Asset.GET_INTERNAL_DEPOSIT_RECORDS}",
            query=kwargs,
            auth=True,
        )

    async def get_master_deposit_address(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Asset.GET_MASTER_DEPOSIT_ADDRESS}",
            query=kwargs,
            auth=True,
        )

    async def get_sub_deposit_address(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Asset.GET_SUB_DEPOSIT_ADDRESS}",
            query=kwargs,
            auth=True,
        )

    async def get_coin_info(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Asset.GET_COIN_INFO}",
            query=kwargs,
            auth=True,
        )

    async def get_withdrawal_records(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Asset.GET_WITHDRAWAL_RECORDS}",
            query=kwargs,
            auth=True,
        )

    async def get_withdrawable_amount(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Asset.GET_WITHDRAWABLE_AMOUNT}",
            query=kwargs,
            auth=True,
        )

    async def withdraw(self, **kwargs):
        return await self._submit_request(
            method="POST",
            path=f"{self.endpoint}{Asset.WITHDRAW}",
            query=kwargs,
            auth=True,
        )

    async def cancel_withdrawal(self, **kwargs):
        return await self._submit_request(
            method="POST",
            path=f"{self.endpoint}{Asset.CANCEL_WITHDRAWAL}",
            query=kwargs,
            auth=True,
        )
