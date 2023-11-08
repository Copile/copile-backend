from errorhandling import ApiError
import asyncio

ApiError.load_error_messages()
# print("-----------------")
# print(ApiError(10003))
# print(ApiError.get_error_message(0))
print("-----------------")


async def handle_error_0():
    # OK
    print("OK")
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
    print("Permission denied, please check your API key permissions.")
    return ApiError.get_error_message(10005)

async def handle_error_10006():
    # Too many visits. Exceeded the API Rate Limit.
    print("Too many visits. Exceeded the API Rate Limit.")
    return ApiError.get_error_message(10006)

async def handle_error_10007():
    # User authentication failed.
    print("User authentication failed.")
    return ApiError.get_error_message(10007)

async def handle_error_10008():
    # Common banned, please check your account mode
    print("Common banned, please check your account mode")
    return ApiError.get_error_message(10008)

async def handle_error_10009():
    # IP has been banned.
    print("IP has been banned.")
    return ApiError.get_error_message(10009)

async def handle_error_10010():
    # Unmatched IP, please check your API key's bound IP addresses.
    print("Unmatched IP, please check your API key's bound IP addresses.")
    return ApiError.get_error_message(10010)

async def handle_error_10014():
    # Invalid duplicate request.
    print("Invalid duplicate request.")
    return ApiError.get_error_message(10014)

async def handle_error_10016():
    # Server error.
    print("Server error.")
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

async def handle_error_10017():
    # Route not found.
    print("Route not found.")
    return ApiError.get_error_message(10017)

async def handle_error_10018():
    # Exceeded the IP Rate Limit.
    print("Exceeded the IP Rate Limit.")
    return ApiError.get_error_message(10018)

async def handle_error_10024():
    # Compliance rules triggered
    print("Compliance rules triggered")
    return ApiError.get_error_message(10024)

async def handle_error_10027():
    # Transactions are banned.
    print("Transactions are banned.")
    return ApiError.get_error_message(10027)

async def handle_error_10028():
    # The API can only be accessed by unified account users.
    print("The API can only be accessed by unified account users.")
    return ApiError.get_error_message(10028)

async def handle_error_10029():
    # The requested symbol is invalid, please check symbol whitelist
    print("The requested symbol is invalid, please check symbol whitelist")
    return ApiError.get_error_message(10029)

async def handle_error_30133():
    # OTC loan: The symbol you select for USDT Perpetual is not allowed by Institutional Lending
    print("OTC loan: The symbol you select for USDT Perpetual is not allowed by Institutional Lending")
    return ApiError.get_error_message(30133)

async def handle_error_30134():
    # OTC loan: The symbol you select for USDC Contract is not allowed by Institutional Lending
    print("OTC loan: The symbol you select for USDC Contract is not allowed by Institutional Lending")
    return ApiError.get_error_message(30134)

async def handle_error_30135():
    # The leverage you select for USDT Perpetual trading cannot exceed the maximum leverage allowed by Institutional Lending
    print("The leverage you select for USDT Perpetual trading cannot exceed the maximum leverage allowed by Institutional Lending")
    return ApiError.get_error_message(30135)

async def handle_error_40004():
    # the order is modified during the process of replacing, please check the order status again
    print("the order is modified during the process of replacing, please check the order status again")
    return ApiError.get_error_message(40004)

async def handle_error_110001():
    # Order does not exist
    print("Order does not exist")
    return ApiError.get_error_message(110001)

async def handle_error_110003():
    # Order price exceeds the allowable range.
    print("Order price exceeds the allowable range.")
    return ApiError.get_error_message(110003)

async def handle_error_110004():
    # Wallet balance is insufficient
    print("Wallet balance is insufficient")
    return ApiError.get_error_message(110004)

async def handle_error_3400214():
    # Server error, please try again later
    print("Server error, please try again later")
    return ApiError.get_error_message(3400214)
    # TODO - Add retry_trade function maybe???

async def handle_error_3400071():
    # The net asset is not satisfied
    print("The net asset is not satisfied")
    return ApiError.get_error_message(3400071)

async def handle_error_3401010():
    # Cannot switch to PM mode (for copy trading master trader)
    print("Cannot switch to PM mode (for copy trading master trader)")
    return ApiError.get_error_message(3401010)

async def handle_error_3400139():
    # The total value of your positions and orders has exceeded the risk limit for a Perpetual or Futures contract
    print("The total value of your positions and orders has exceeded the risk limit for a Perpetual or Futures contract")
    return ApiError.get_error_message(3400139)

async def handle_error(error_code):
    error_map = {
        int(error_code): globals()[f"handle_error_{error_code}"]
        for error_code in ApiError.error_messages.keys()
        if f"handle_error_{error_code}" in globals()
    }

    if error_code in error_map:
        return await error_map[error_code]()
    else:
        print(f"Unknown error code: {error_code}")
        return None
    
async def main():
    ApiError.load_error_messages()
    # Call the handle_error function with a specific error code
    result = await handle_error(10005)
    print(f"Result: {result}")

# Run the event loop
if __name__ == "__main__":
    asyncio.run(main())
