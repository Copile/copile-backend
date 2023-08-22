const {KeyManagementServiceClient} = require('@google-cloud/kms');

const kms = new KeyManagementServiceClient();

async function decryptData(ciphertext, traderName) {
    const [result] = await kms.asymmetricDecrypt({
      name: `${process.env.keyRing}/${traderName}/cryptoKeyVersions/1`,
      ciphertext: Buffer.from(ciphertext, 'base64'),
    });
  
    const plaintext = result.plaintext.toString();

    return plaintext;
}

module.exports = decryptData;