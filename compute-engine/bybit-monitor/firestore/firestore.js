const { Firestore } = require("@google-cloud/firestore");
const CustomError = require("./error");
const db = new Firestore();

async function fetchLatestTradeDoc(traderId, symbol, exchange, side) {
    try {
      const tradeQuerySnapshot = await db
        .collection("traders")
        .doc(traderId)
        .collection("trades")
        .where("symbol", "==", symbol)
        .where("exchange", "==", exchange)
        .where("side", "==", side)
        .orderBy("created_at", "desc")
        .limit(1)
        .get();
  
      if (tradeQuerySnapshot.empty) {
        console.log(
          `No trade document found for trader ${traderId}, symbol ${symbol}, exchange ${exchange}, and side ${side}`
        );
        return null;
      }
  
      return tradeQuerySnapshot.docs[0];
    } catch (error) {
      throw new CustomError({
        message: `Error fetching trade document: ${error.message}`,
        status: 500,
        source: "fetchLatestTradeDoc",
      });
    }
}