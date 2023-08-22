const {KeyManagementServiceClient} = require('@google-cloud/kms');

const kms = new KeyManagementServiceClient();

async function decryptData(ciphertext, userName) {
    const [result] = await kms.asymmetricDecrypt({
      name: `${process.env.keyRing}/${userName}/cryptoKeyVersions/1`,
      ciphertext: Buffer.from(ciphertext, 'base64'),
    });
  
    const plaintext = result.plaintext.toString();

    return plaintext;
}

module.exports = decryptData;