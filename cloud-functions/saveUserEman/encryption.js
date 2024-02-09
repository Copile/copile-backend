const { KeyManagementServiceClient } = require('@google-cloud/kms');

async function createUserKey(memberName) {
    // Creates a client
    const client = new KeyManagementServiceClient();

    // Define the parent key ring
    const parent = 'projects/copile/locations/global/keyRings/UserAPIKeys';

    // Define key purpose
    const purpose = 'ASYMMETRIC_DECRYPT';

    // Create the key
    const [cryptoKey] = await client.createCryptoKey({
        parent: parent,
        cryptoKeyId: memberName,
        cryptoKey: {
            purpose: purpose,
            versionTemplate: {
                algorithm: 'RSA_DECRYPT_OAEP_2048_SHA256', // use 'RSA_SIGN_PSS_2048_SHA256' for 'ASYMMETRIC_SIGN'
            },
        },
    });
    return
}

module.exports = {
  createUserKey
}