from ..api import API


class UMFutures(API):
    def __init__(self, key=None, secret=None, **kwargs):
        if "base_url" not in kwargs:
            kwargs["base_url"] = "https://fapi.binance.com"
        super().__init__(key, secret, **kwargs)

    # MARKETS
    from .market import ping
    from .market import time
    from .market import exchange_info
    from .market import depth
    from .market import trades
    from .market import historical_trades
    from .market import agg_trades
    from .market import klines
    from .market import continuous_klines
    from .market import index_price_klines
    from .market import mark_price_klines
    from .market import mark_price
    from .market import funding_rate
    from .market import ticker_24hr_price_change
    from .market import ticker_price
    from .market import book_ticker
    from .market import open_interest
    from .market import open_interest_hist
    from .market import top_long_short_position_ratio
    from .market import long_short_account_ratio
    from .market import top_long_short_account_ratio
    from .market import taker_long_short_ratio
    from .market import blvt_kline
    from .market import index_info
    from .market import asset_Index

    # ACCOUNT(including orders and trades)
    from .account import change_position_mode
    from .account import get_position_mode
    from .account import change_multi_asset_mode
    from .account import get_multi_asset_mode
    from .account import new_order
    from .account import new_order_test
    from .account import modify_order
    from .account import new_batch_order
    from .account import query_order
    from .account import cancel_order
    from .account import cancel_open_orders
    from .account import cancel_batch_order
    from .account import countdown_cancel_order
    from .account import get_open_orders
    from .account import get_orders
    from .account import get_all_orders
    from .account import balance
    from .account import account
    from .account import change_leverage
    from .account import change_margin_type
    from .account import modify_isolated_position_margin
    from .account import get_position_margin_history
    from .account import get_position_risk
    from .account import get_account_trades
    from .account import get_income_history
    from .account import leverage_brackets
    from .account import adl_quantile
    from .account import force_orders
    from .account import api_trading_status
    from .account import commission_rate
    from .account import download_transactions_asyn
    from .account import aysnc_download_info

    # STREAMS
    from .data_stream import new_listen_key
    from .data_stream import renew_listen_key
    from .data_stream import close_listen_key

    # PORTFOLIO MARGIN
    from .portfolio_margin import pm_exchange_info
