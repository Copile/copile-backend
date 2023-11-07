from google.cloud import kms_v1
from google.protobuf.json_format import MessageToDict
import base64
import asyncio

async def decryptData(account_id, ciphertext):
    # Create the client.
    client = kms_v1.KeyManagementServiceClient()

    # Convert the ciphertext to bytes.
    ciphertext_bytes = base64.b64decode(ciphertext)

    try:
        # Use the KMS API to decrypt the data.
        response = client.asymmetric_decrypt(request={'name': f"projects/copile/locations/global/keyRings/UserAPIKeys/cryptoKeys/{account_id}/cryptoKeyVersions/1", 'ciphertext': ciphertext_bytes})

        # Extract and return the plaintext.
        plaintext = response.plaintext
        return plaintext.decode('utf-8')

    except Exception as e:
        print(f'Error decrypting data: {e}')
        raise e
