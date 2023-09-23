const { Firestore } = require("@google-cloud/firestore");
const db = new Firestore();

async function getTestnetPositions(trader_id) {
  try {
    const tradesData = await db
      .collection("traders")
      .doc(trader_id)
      .collection("trades")
      .where("status", "==", "active")
      .get()
      .then((querySnapshot) => {
        return querySnapshot.docs.map((doc) => doc.data());
      });
    return tradesData;
  } catch (e) {
    console.error(
      `An error occurred while retrieving trades from Binance. Error message: ${e}`
    );
    return [];
  }
}

module.exports = { getTestnetPositions };
