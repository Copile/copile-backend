#from trade import send_trade
import os
import sys
import asyncio
sys.path.append("cloud-run/TESTNET/asia-testnet-exec-handler/exchanges/bybit")
from trade import send_trade

async def main():
    # Call the handle_error function with a specific error code
    print(send_trade(1))

# Run the event loop
if __name__ == "__main__":
    asyncio.run(main())
