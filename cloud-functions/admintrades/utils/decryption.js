const { KeyManagementServiceClient } = require("@google-cloud/kms");

const kms = new KeyManagementServiceClient();

async function decryptData(ciphertext, traderName) {
  try {
    const [result] = await kms.asymmetricDecrypt({
      name: `${process.env.keyRing}/${traderName}/cryptoKeyVersions/1`,
      ciphertext: Buffer.from(ciphertext, "base64"),
    });

    return result.plaintext.toString();
  } catch (error) {
    throw new Error(`Failed to decrypt data: ${error.message}`);
  }
}

module.exports = decryptData;
