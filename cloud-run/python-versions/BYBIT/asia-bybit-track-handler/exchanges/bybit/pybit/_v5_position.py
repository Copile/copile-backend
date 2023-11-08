from ._http_manager import _V5HTTPManager
from .position import Position

class PositionHTTP(_V5HTTPManager):
    async def get_positions(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Position.GET_POSITIONS}",
            query=kwargs,
            auth=True,
        )

    async def set_leverage(self, **kwargs):
        return await self._submit_request(
            method="POST",
            path=f"{self.endpoint}{Position.SET_LEVERAGE}",
            query=kwargs,
            auth=True,
        )

    async def switch_margin_mode(self, **kwargs):
        return await self._submit_request(
            method="POST",
            path=f"{self.endpoint}{Position.SWITCH_MARGIN_MODE}",
            query=kwargs,
            auth=True,
        )

    async def set_tp_sl_mode(self, **kwargs):
        return await self._submit_request(
            method="POST",
            path=f"{self.endpoint}{Position.SET_TP_SL_MODE}",
            query=kwargs,
            auth=True,
        )

    async def switch_position_mode(self, **kwargs):
        return await self._submit_request(
            method="POST",
            path=f"{self.endpoint}{Position.SWITCH_POSITION_MODE}",
            query=kwargs,
            auth=True,
        )

    async def set_risk_limit(self, **kwargs):
        return await self._submit_request(
            method="POST",
            path=f"{self.endpoint}{Position.SET_RISK_LIMIT}",
            query=kwargs,
            auth=True,
        )

    async def set_trading_stop(self, **kwargs):
        return await self._submit_request(
            method="POST",
            path=f"{self.endpoint}{Position.SET_TRADING_STOP}",
            query=kwargs,
            auth=True,
        )

    async def set_auto_add_margin(self, **kwargs):
        return await self._submit_request(
            method="POST",
            path=f"{self.endpoint}{Position.SET_AUTO_ADD_MARGIN}",
            query=kwargs,
            auth=True,
        )

    async def get_executions(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Position.GET_EXECUTIONS}",
            query=kwargs,
            auth=True,
        )

    async def get_closed_pnl(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Position.GET_CLOSED_PNL}",
            query=kwargs,
            auth=True,
        )
