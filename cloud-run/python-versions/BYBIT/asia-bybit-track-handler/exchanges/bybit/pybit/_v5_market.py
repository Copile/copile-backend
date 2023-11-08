from ._http_manager import _V5HTTPManager
from .market import Market

class MarketHTTP(_V5HTTPManager):
    async def get_kline(self, **kwargs) -> dict:
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Market.GET_KLINE}",
            query=kwargs,
        )

    async def get_mark_price_kline(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Market.GET_MARK_PRICE_KLINE}",
            query=kwargs,
        )

    async def get_index_price_kline(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Market.GET_INDEX_PRICE_KLINE}",
            query=kwargs,
        )

    async def get_premium_index_price_kline(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Market.GET_PREMIUM_INDEX_PRICE_KLINE}",
            query=kwargs,
        )

    async def get_instruments_info(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Market.GET_INSTRUMENTS_INFO}",
            query=kwargs,
        )

    async def get_orderbook(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Market.GET_ORDERBOOK}",
            query=kwargs,
        )

    async def get_tickers(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Market.GET_TICKERS}",
            query=kwargs,
        )

    async def get_funding_rate_history(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Market.GET_FUNDING_RATE_HISTORY}",
            query=kwargs,
        )

    async def get_public_trade_history(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Market.GET_PUBLIC_TRADING_HISTORY}",
            query=kwargs,
        )

    async def get_open_interest(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Market.GET_OPEN_INTEREST}",
            query=kwargs,
        )

    async def get_historical_volatility(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Market.GET_HISTORICAL_VOLATILITY}",
            query=kwargs,
        )

    async def get_insurance(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Market.GET_INSURANCE}",
            query=kwargs,
        )

    async def get_risk_limit(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Market.GET_RISK_LIMIT}",
            query=kwargs,
        )

    async def get_option_delivery_price(self, **kwargs):
        return await self._submit_request(
            method="GET",
            path=f"{self.endpoint}{Market.GET_OPTION_DELIVERY_PRICE}",
            query=kwargs,
        )
