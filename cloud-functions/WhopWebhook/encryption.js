const { KeyManagementServiceClient } = require('@google-cloud/kms');

async function createUserKey(memberName) {
    const client = new KeyManagementServiceClient();
    const parent = 'projects/copile/locations/global/keyRings/UserAPIKeys';
    const purpose = 'ASYMMETRIC_DECRYPT';

    // Check if the cryptokey already exists
    try {
        await client.getCryptoKey({
            name: `${parent}/cryptoKeys/${memberName}`,
        });
        console.log('Cryptokey already exists.');
        return;
    } catch (error) {
        // Cryptokey doesn't exist, create it
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
        console.log('Cryptokey created successfully.');
        return;
    }
}

async function deleteExchangeKey(memberName) {
  const client = new KeyManagementServiceClient();

  try {
    // Destroy the specified exchange-specific key
    await client.destroyCryptoKeyVersion({
      name: `${process.env.keyRingName}/cryptoKeys/${memberName}/cryptoKeyVersions/1`,
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