from .session_factory import create_session
import logging

logger = logging.getLogger(__name__)


async def trade_execution(api_key, api_secret, api_passphrase, method, data):
    try:

        trade_execution_result = None
        if method == 'bulk_order':
            exchange = data['trader_exchange']
            session = create_session(exchange, api_key, api_secret, api_passphrase)
            trade_execution_result = await session.bulk_order(data)
        elif method == 'send_sl':
            exchange = data['trader_exchange']
            session = create_session(exchange, api_key, api_secret, api_passphrase)
            trade_execution_result = await session.send_sl(data)
        elif method == 'replace_sl':
            exchange = data['trader_exchange']
            session = create_session(exchange, api_key, api_secret, api_passphrase)
            trade_execution_result = await session.replace_sl(data)
        elif method == 'bulk_tp':
            exchange = data['trader_exchange']
            session = create_session(exchange, api_key, api_secret, api_passphrase)
            trade_execution_result = await session.bulk_tp(data)
        elif method == 'cancel_order':
            exchange = data['trader_exchange']
            session = create_session(exchange, api_key, api_secret, api_passphrase)
            trade_execution_result = await session.cancel_order(data)
        elif method == 'cancel_all_tps':
            exchange = data['trader_exchange']
            session = create_session(exchange, api_key, api_secret, api_passphrase)
            trade_execution_result = await session.cancel_all_tps(data)
        elif method == 'cancel_all_orders':
            exchange = data['trader_exchange']
            session = create_session(exchange, api_key, api_secret, api_passphrase)
            trade_execution_result = await session.cancel_all_orders(data)
        elif method == 'partial_close':
            exchange = data['trader_exchange']
            session = create_session(exchange, api_key, api_secret, api_passphrase)
            trade_execution_result = await session.partial_close(data)

        return trade_execution_result

    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)
