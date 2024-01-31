import base64
from google.cloud import kms_v1

async def decrypt_data(trader_id, ciphertext):
    # Create the client.
    client = kms_v1.KeyManagementServiceClient()

    # Convert the ciphertext to bytes.
    ciphertext_bytes = base64.b64decode(ciphertext)

    # Use the KMS API to decrypt the data.
    response = client.asymmetric_decrypt(request={'name': f"projects/copile/locations/global/keyRings/UserAPIKeys/cryptoKeys/{trader_id}/cryptoKeyVersions/1", 'ciphertext': ciphertext_bytes})

    # Extract and return the plaintext.
    plaintext = response.plaintext
    return plaintext.decode('utf-8')