const { KeyManagementServiceClient } = require('@google-cloud/kms');

async function getPublicKey(traderName) {
    // Creates a client
    const client = new KeyManagementServiceClient();

    // Define the resource name
    const name = `${process.env.keyRingName}/${traderName}/cryptoKeyVersions/1`;

    // Get the public key
    const [publicKey] = await client.getPublicKey({
        name: name,
    });

    return publicKey.pem;
}


module.exports = {
  getPublicKey
}