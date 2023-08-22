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
                algorithm: 'RSA_DECRYPT_OAEP_2048_SHA256',
            },
        },
    });
    return
}

async function deleteExchangeKey(memberName) {
  const client = new KeyManagementServiceClient();

  try {
    // Destroy the specified exchange-specific key
    await client.destroyCryptoKeyVersion({
      name: `${process.env.keyRingName}${memberName}/cryptoKeyVersions/1`,
    });

    console.log('Exchange key destroyed successfully.');
  } catch (error) {
    console.error('Error destroying exchange key:', error);
    throw error;
  }
}

module.exports = {
    createUserKey,
    deleteExchangeKey
}