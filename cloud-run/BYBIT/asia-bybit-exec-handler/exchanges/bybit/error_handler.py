from errorhandling import ApiError
import asyncio

ApiError.load_error_messages()
print("-----------------")
print(ApiError(10003))
print(ApiError.get_error_message(0))
print()
print("-----------------")


async def handle_error_0():
    # OK
    print("OK")
    print(ApiError().error_messages.get("0"))
    return ApiError.get_error_message(0)

# TODO - Add retry_trade function
async def handle_error_10000():
    # Server Timeout
    for i in range(5):
        try:
            # your trade code here
            break
        except ApiError as e:
            if e.error_code == 10000 and i < 4:
                print("Timeout error occurred. Retrying...")
                await asyncio.sleep(5)
            else:
                raise
    else:
        print("Trade failed after 5 retries.")
        return ApiError.get_error_message(10000)
    
async def handle_error_10001():
    # Request parameter error
    pass

async def handle_error_10002():
    # The request time exceeds the time window range.
    pass

async def handle_error_10003():
    # API key is invalid.
    print("API key is invalid.")
    return ApiError.get_error_message(10003)

async def handle_error_10004():
    # Error sign, please check your signature generation algorithm.
    print("Error sign, please check your signature generation algorithm.")
    return ApiError.get_error_message(10004)

async def handle_error_10005():
    # Permission denied, please check your API key permissions.
    pass

async def handle_error_10006():
    # Too many visits. Exceeded the API Rate Limit.
    pass

async def handle_error_10007():
    # User authentication failed.
    pass

async def handle_error_10008():
    # Common banned, please check your account mode
    pass

async def handle_error_10009():
    # IP has been banned.
    pass

async def handle_error_10010():
    # Unmatched IP, please check your API key's bound IP addresses.
    pass

async def handle_error_10014():
    # Invalid duplicate request.
    pass

async def handle_error_10016():
    # Server error.
    pass

async def handle_error_10017():
    # Route not found.
    pass

async def handle_error_10018():
    # Exceeded the IP Rate Limit.
    pass

async def handle_error_10024():
    # Compliance rules triggered
    pass

async def handle_error_10027():
    # Transactions are banned.
    pass

async def handle_error_10028():
    # The API can only be accessed by unified account users.
    pass

async def handle_error_10029():
    # The requested symbol is invalid, please check symbol whitelist
    pass

async def handle_error_30133():
    # OTC loan: The symbol you select for USDT Perpetual is not allowed by Institutional Lending
    pass

async def handle_error_30134():
    # OTC loan: The symbol you select for USDC Contract is not allowed by Institutional Lending
    pass

async def handle_error_30135():
    # The leverage you select for USDT Perpetual trading cannot exceed the maximum leverage allowed by Institutional Lending
    pass

async def handle_error_40004():
    # the order is modified during the process of replacing, please check the order status again
    pass

async def handle_error_110001():
    # Order does not exist
    pass

async def handle_error_110003():
    # Order price exceeds the allowable range.
    pass

async def handle_error_110004():
    # Wallet balance is insufficient
    pass

async def handle_error_3400214():
    # Server error, please try again later
    pass

async def handle_error_3400071():
    # The net asset is not satisfied
    pass

async def handle_error_3401010():
    # Cannot switch to PM mode (for copy trading master trader)
    pass

async def handle_error_3400139():
    # The total value of your positions and orders has exceeded the risk limit for a Perpetual or Futures contract
    pass

ApiError.print_error_messages()
