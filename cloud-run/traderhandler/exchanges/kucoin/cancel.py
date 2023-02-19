from kucoin_futures.client import Trade

api_key = "637967ef0adca800011fd0a6"
api_secret = "11b7ceaf-7a2a-4134-8503-247642a01fe3"
api_passphrase = "mira12345678"


def send_cancel(account_id, order_id):
    # Connecting to Kucoin API
    client_trade = Trade(key=api_key, secret=api_secret, passphrase=api_passphrase, is_sandbox=False, url='')

    # Cancelling specific order
    try:
        cancel = client_trade.cancel_order(
            orderId=order_id,
        )
        print(cancel)
        return f"Cancelled order ID: {str(order_id)} for {account_id}"
    except Exception as error:
        print(error)
