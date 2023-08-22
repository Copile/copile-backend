const { Firestore } = require('@google-cloud/firestore');
const db = new Firestore();

async function traderCheck(traderId) {
  try {
    const documentRef = db.collection("traders").doc(traderId);
    const documentSnapshot = await documentRef.get();

    return documentSnapshot.exists;
  } catch (error) {
    console.log(error);
    throw error;
  }
}

async function checkIfTradeExists(traderId, tradeId) {
  try {
    // Get a reference to the trade document in the trades subcollection
    const documentRef = db.collection("traders").doc(traderId).collection('trades').doc(tradeId);

    // Get the document
    const documentSnapshot = await documentRef.get();

    // Check if the document exists
    return documentSnapshot.exists;
  } catch (error) {
    console.log(error);
    throw error;
  }
}

module.exports = {
    traderCheck,
    checkIfTradeExists
}
