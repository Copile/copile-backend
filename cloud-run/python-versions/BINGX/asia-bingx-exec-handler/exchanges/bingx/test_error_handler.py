import pytest
from unittest.mock import MagicMock
from exchanges.bingx.error_handler import handle_error

@pytest.mark.asyncio
async def test_handle_error():
    account_id = 123
    error_code = 100500
    payload = {'foo': 'bar'}
    keys = {'key1': 'value1', 'key2': 'value2'}

    # Test case 1: error code is known
    error_messages = {'100500': 'Server busy1'}
    error_funcs = {'100500': MagicMock()}
    error_funcs['100500'].return_value = None
    result = await handle_error(account_id, error_code, payload, keys)
    assert result == error_funcs['100500'].return_value
    print(result) # print the result of the test

    # Test case 2: error code is unknown
    error_code = 999999
    error_messages = {'100500': 'Server busy1'}
    error_funcs = {'100500': MagicMock()}
    error_funcs['100500'].return_value = None
    result = await handle_error(account_id, error_code, payload, keys)
    assert result is None
    print(result) # print the result of the test

    # Test case 3: error code is known and has a function to handle it
    error_code = 100500
    error_messages = {'100500': 'Server busy1'}
    error_funcs = {'100500': MagicMock()}
    error_funcs['100500'].return_value = {'status': 'success'}
    result = await handle_error(account_id, error_code, payload, keys)
    assert result == error_funcs['100500'].return_value
    error_funcs['100500'].assert_called_once_with(account_id, error_code, payload, keys)
    print(result) # print the result of the test

    # Test case 4: error code is known but does not have a function to handle it
    error_code = 100500
    error_messages = {'100500': 'Server busy1'}
    error_funcs = {}
    result = await handle_error(account_id, error_code, payload, keys)
    assert result is None
    print("No. 4")
    print(result) # print the result of the test