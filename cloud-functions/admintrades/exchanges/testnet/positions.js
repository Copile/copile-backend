const { Firestore } = require("@google-cloud/firestore");
const CustomError = require("../../utils/error"); // Assuming the CustomError is in this path
const db = new Firestore();

/**
 * Retrieves active positions for a given trader ID from Firestore in a testnet environment.
 *
 * @async
 * @param {string} traderId - The unique ID of the trader.
 * @returns {Promise<Array<Object>>} An array of active trade data objects.
 * @throws {CustomError} Throws a custom error if database operation fails.
 */
async function getTestnetPositions(traderId) {
  try {
    const querySnapshot = await db
      .collection("traders")
      .doc(traderId)
      .collection("trades")
      .where("status", "==", "active")
      .get();

    return querySnapshot.docs.map((doc) => doc.data());
  } catch (e) {
    throw new CustomError({
      message: `Failed to fetch testnet positions: ${e.message}`,
      status: 500,
      source: "getTestnetPositions",
    });
  }
}

module.exports = { getTestnetPositions };
