const { KeyManagementServiceClient } = require('@google-cloud/kms');

async function getPublicKey(memberName) {
    // Creates a client
    const client = new KeyManagementServiceClient();

    // Define the resource name
    const name = `${process.env.keyRingName}/${memberName}/cryptoKeyVersions/1`;

    // Get the public key
    const [publicKey] = await client.getPublicKey({
        name: name,
    });

    return publicKey.pem;
}


module.exports = {
  getPublicKey
}