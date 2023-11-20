from .session_factory import create_session
import logging

logger = logging.getLogger(__name__)

async def trade_execution(api_key, api_secret, api_passphrase, method, data):
    try:
        session = None
        trade_execution_result = None

        if method == 'bulkOrder':
            exchange = data['trader_exchange']
            session = create_session(exchange, api_key, api_secret, api_passphrase)
            trade_execution_result = await session.bulk_order(data)
        elif method == 'sendSl':
            exchange = data['trader_exchange']
            session = create_session(exchange, api_key, api_secret, api_passphrase)
            trade_execution_result = await session.send_sl(data)
        elif method == 'replaceSL':
            exchange = data['trader_exchange']
            session = create_session(exchange, api_key, api_secret, api_passphrase)
            trade_execution_result = await session.replace_sl(data)
        elif method == 'bulkTP':
            exchange = data['trader_exchange']
            session = create_session(exchange, api_key, api_secret, api_passphrase)
            trade_execution_result = await session.bulk_tp(data)
        elif method == 'cancelOrder':
            exchange = data['trader_exchange']
            session = create_session(exchange, api_key, api_secret, api_passphrase)
            trade_execution_result = await session.cancel_order(data)
        elif method == 'cancelAllTPs':
            exchange = data['trader_exchange']
            session = create_session(exchange, api_key, api_secret, api_passphrase)
            trade_execution_result = await session.cancel_all_tps(data)
        elif method == 'cancelAllOrders':
            exchange = data['trader_exchange']
            session = create_session(exchange, api_key, api_secret, api_passphrase)
            trade_execution_result = await session.cancel_all_orders(data)
        elif method == 'partialClose':
            exchange = data['trader_exchange']
            session = create_session(exchange, api_key, api_secret, api_passphrase)
            trade_execution_result = await session.partial_close(data)

        return trade_execution_result

    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)