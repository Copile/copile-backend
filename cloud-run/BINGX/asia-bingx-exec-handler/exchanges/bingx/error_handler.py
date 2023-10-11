import json
from ..notification import send_notification
from .retry import retry_trade
import time

# Load error messages once
with open("errors.json", "r") as f:
    error_messages = json.load(f)

async def error_100001(account_id, error_code, payload, keys):
    payload = {
        "user_id": account_id
    }
    
    await send_notification(payload, "/error?type=api")
    print("Extra handling for error 100001.")

async def error_101204(account_id, error_code, payload, keys):
    payload = {
        "user_id": account_id
    }
    await send_notification(payload, "/error?type=lowMargin")
    print("Extra handling for error 101204.")

async def error_100440(account_id, error_code, payload, keys):
    print("Extra handling for error 100440.")

async def error_100400(account_id, error_code, payload, keys):
    print("Extra handling for error 100440.")

async def error_100500(account_id, error_code, payload, keys):
    print("Extra handling for error 100500.")

async def error_100503(account_id, error_code, payload, keys):
    time.sleep(5)
    
    if payload["endpoint"] == "trade":
        return await retry_trade(account_id, payload, keys)

async def error_100004(account_id, error_code, payload, keys):
    payload = {
        "user_id": account_id
    }
    await send_notification(payload, "/error?type=permissions")
    print("Extra handling for error 100004.")

async def error_80014(account_id, error_code, payload, keys):
    time.sleep(5)
    
    if payload["endpoint"] == "trade":
        return await retry_trade(account_id, payload, keys)
    
async def error_80016(account_id, error_code, payload, keys):
    print("Extra handling for error 80016.")

async def error_100421(account_id, error_code, payload, keys):
    time.sleep(5)
    
    if payload["endpoint"] == "trade":
        return await retry_trade(account_id, payload, keys)

async def error_50001(account_id, error_code, payload, keys):
    payload = {
        "user_id": account_id
    }
    
    await send_notification(payload, "/error?type=margin")
    print("Extra handling for error 50001.")

error_funcs = {
    '100001': error_100001,
    '101204': error_101204,
    '100440': error_100440,
    '100400': error_100400,
    '100500': error_100500,
    '100503': error_100503,
    '100004': error_100004,
    '80014': error_80014,
    '80016': error_80016,
    '100421': error_100421,
    '50001': error_50001,
    # Add more error code to function mappings here
}

async def handle_error(account_id, error_code, payload, keys):
    error_code_str = str(error_code)
    if error_code_str in error_messages:
        print(f"Handling error {error_code} - {error_messages[error_code_str]}")
        func = error_funcs.get(error_code_str)
        if func:
            return await func(account_id, error_code, payload, keys)
    else:
        print(f"{error_messages['unknown']}{error_code}.")

# Handler for server errors
async def handle_server_error(status_code, error_msg):
    print(f"Handling server error: Status Code: {status_code}, Message: {error_msg}")
