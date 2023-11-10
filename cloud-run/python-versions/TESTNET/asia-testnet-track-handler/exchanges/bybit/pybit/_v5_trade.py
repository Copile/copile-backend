from ._http_manager import _V5HTTPManager
from .trade import Trade

class TradeHTTP(_V5HTTPManager):
    async def place_order(self, **kwargs):
        return await self._submit_request(
            method="POST",
            path=f"{self.endpoint}{Trade.PLACE_ORDER}",
            query=kwargs,
            auth=True,
        )

    async def amend_order(self, **kwargs):
        return await self._submit_request(
            method="POST",
            path=f"{self.endpoint}{Trade.AMEND_ORDER}",
            query=kwargs,
            auth=True,
        )

    async def cancel_order(self, **kwargs):
        return await self._submit_request(
            method="POST",
            path=f"{self.endpoint}{Trade.CANCEL_ORDER}",
            query=kwargs,
            auth=True,
        )

    async def get_open_orders(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Trade.GET_OPEN_ORDERS}",
            query=kwargs,
            auth=True,
        )

    async def cancel_all_orders(self, **kwargs):
        return await self._submit_request(
            method="POST",
            path=f"{self.endpoint}{Trade.CANCEL_ALL_ORDERS}",
            query=kwargs,
            auth=True,
        )

    async def get_order_history(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Trade.GET_ORDER_HISTORY}",
            query=kwargs,
            auth=True,
        )

    async def place_batch_order(self, **kwargs):
        return await self._submit_request(
            method="POST",
            path=f"{self.endpoint}{Trade.BATCH_PLACE_ORDER}",
            query=kwargs,
            auth=True,
        )

    async def amend_batch_order(self, **kwargs):
        return await self._submit_request(
            method="POST",
            path=f"{self.endpoint}{Trade.BATCH_AMEND_ORDER}",
            query=kwargs,
            auth=True,
        )

    async def cancel_batch_order(self, **kwargs):
        return await self._submit_request(
            method="POST",
            path=f"{self.endpoint}{Trade.BATCH_CANCEL_ORDER}",
            query=kwargs,
            auth=True,
        )

    async def get_borrow_quota(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Trade.GET_BORROW_QUOTA}",
            query=kwargs,
            auth=True,
        )

    async def set_dcp(self, **kwargs):
        return await self._submit_request(
            method="POST",
            path=f"{self.endpoint}{Trade.SET_DCP}",
            query=kwargs,
            auth=True,
        )
