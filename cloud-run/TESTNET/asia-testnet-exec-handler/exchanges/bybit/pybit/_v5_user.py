from ._http_manager import _V5HTTPManager
from .user import User

class UserHTTP(_V5HTTPManager):
    async def create_sub_uid(self, **kwargs):
        return await self._submit_request(
            method="POST",
            path=f"{self.endpoint}{User.CREATE_SUB_UID}",
            query=kwargs,
            auth=True,
        )

    async def create_sub_api_key(self, **kwargs):
        return await self._submit_request(
            method="POST",
            path=f"{self.endpoint}{User.CREATE_SUB_API_KEY}",
            query=kwargs,
            auth=True,
        )

    async def get_sub_uid_list(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{User.GET_SUB_UID_LIST}",
            query=kwargs,
            auth=True,
        )

    async def freeze_sub_uid(self, **kwargs):
        return await self._submit_request(
            method="POST",
            path=f"{self.endpoint}{User.FREEZE_SUB_UID}",
            query=kwargs,
            auth=True,
        )

    async def get_api_key_information(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{User.GET_API_KEY_INFORMATION}",
            query=kwargs,
            auth=True,
        )

    async def modify_master_api_key(self, **kwargs):
        return await self._submit_request(
            method="POST",
            path=f"{self.endpoint}{User.MODIFY_MASTER_API_KEY}",
            query=kwargs,
            auth=True,
        )

    async def modify_sub_api_key(self, **kwargs):
        return await self._submit_request(
            method="POST",
            path=f"{self.endpoint}{User.MODIFY_SUB_API_KEY}",
            query=kwargs,
            auth=True,
        )

    async def delete_master_api_key(self, **kwargs):
        return await self._submit_request(
            method="POST",
            path=f"{self.endpoint}{User.DELETE_MASTER_API_KEY}",
            query=kwargs,
            auth=True,
        )

    async def delete_sub_api_key(self, **kwargs):
        return await self._submit_request(
            method="POST",
            path=f"{self.endpoint}{User.DELETE_SUB_API_KEY}",
            query=kwargs,
            auth=True,
        )

    async def get_affiliate_user_info(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{User.GET_AFFILIATE_USER_INFO}",
            query=kwargs,
            auth=True,
        )

    async def get_uid_wallet_type(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{User.GET_UID_WALLET_TYPE}",
            query=kwargs,
            auth=True,
        )
