from metaapi_cloud_sdk import MetaApi

async def get_connection(meta_id, token):
        try:
            # Connect to MetaApi
            api = MetaApi(token)

            # Get meta Account
            account = await api.metatrader_account_api.get_account(meta_id)

            # Wait until account is deployed and connected to broker
            print('Waiting for API server to connect to broker (may take couple of minutes)')
            await account.wait_connected()

            # Connect to MetaApi API
            connection = account.get_streaming_connection()
            await connection.connect()

            # Wait until terminal state synchronized to the local state
            print('Waiting for SDK to synchronize to terminal state (may take some time depending on your history size)')
            await connection.wait_synchronized({'timeoutInSeconds': 600})

            return connection
        except Exception as e:
            raise e