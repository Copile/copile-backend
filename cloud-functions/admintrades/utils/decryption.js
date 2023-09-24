const { KeyManagementServiceClient } = require("@google-cloud/kms");
const CustomError = require("./error");

const kms = new KeyManagementServiceClient();

/**
 * Decrypts the given ciphertext using Google's KMS and a trader-specific key.
 *
 * @param {string} ciphertext - The data to be decrypted.
 * @param {string} traderName - The name of the trader, used for key identification.
 * @throws {CustomError} When decryption fails.
 * @returns {Promise<string>} The decrypted plaintext.
 */
async function decryptData(ciphertext, traderName) {
  try {
    const [result] = await kms.asymmetricDecrypt({
      name: `${process.env.keyRing}/${traderName}/cryptoKeyVersions/1`,
      ciphertext: Buffer.from(ciphertext, "base64"),
    });

    return result.plaintext.toString();
  } catch (error) {
    throw new CustomError({
      message: `Failed to decrypt data: ${error.message}`,
      status: 500,
      source: "decryption",
    });
  }
}

module.exports = { decryptData };
