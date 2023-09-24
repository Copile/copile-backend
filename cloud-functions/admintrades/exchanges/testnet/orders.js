const { Firestore } = require("@google-cloud/firestore");
const CustomError = require("../../utils/error"); // Assuming the CustomError is in this path
const db = new Firestore();

/**
 * Retrieves open orders for a given trader ID from Firestore in a testnet environment.
 *
 * @async
 * @param {string} traderId - The unique ID of the trader.
 * @returns {Promise<Array<Object>>} An array of active order data objects.
 * @throws {CustomError} Throws a custom error if database operation fails.
 */
async function getTestnetOrders(traderId) {
  try {
    const querySnapshot = await db
      .collection("traders")
      .doc(traderId)
      .collection("trades")
      .where("status", "==", "pending")
      .get();

    return querySnapshot.docs.map((doc) => doc.data());
  } catch (e) {
    throw new CustomError({
      message: `Failed to fetch testnet orders: ${e.message}`,
      status: 500,
      source: "getTestnetPositions",
    });
  }
}

module.exports = { getTestnetOrders };
