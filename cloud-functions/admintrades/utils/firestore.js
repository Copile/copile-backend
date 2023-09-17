const { Firestore } = require("@google-cloud/firestore");
const db = new Firestore();

async function mapPositionToTrade(position, trader, symbol, exchange, side) {
    // Fetch the trade id
    const tradeQuerySnapshot = await db
      .collection("traders")
      .doc(trader)
      .collection("trades")
      .where("symbol", "==", symbol)
      .where("exchange", "==", exchange)
      .where("side", "==", side)
      .orderBy("created_at", "desc")
      .limit(1)
      .get();
  
    if (tradeQuerySnapshot.empty != false) {
      console.log(
        `No trade document found for trader ${trader}, symbol ${symbol}, exchange ${exchange}, and side ${side}`
      );
      return;
    }
    const tradeDoc = tradeQuerySnapshot.docs[0];
    const tradeData = tradeDoc.data(); // Get data from the trade document
  
    // Fetch details from the position object
    let isIsolated = position.tradeMode === 1 ? "isolated" : "cross";
  
    return {
      trade_id: tradeDoc.id, // Use the fetched trade id
      symbol: position.symbol,
      side:
        position.side.charAt(0).toUpperCase() +
        position.side.slice(1).toLowerCase(),
      margin_mode: isIsolated,
      leverage: position.leverage,
      quantity: String(position.size),
      margin: position.margin,
      entry_price: position.entryPrice,
      unrealised_pnl: position.unrealised_pnl,
      unrealised_pnl_pct: position.unrealised_pnl_pct,
      realised_pnl: position.realised_pnl,
      created_at: tradeData.created_at, // Include the 'created_at' field from the trade document
    };
  }

  async function getTradeDoc(trader, symbol, exchange, side) {
    // Reformat the side variable to have the first letter capital and the rest lowercase
    const formattedSide =
      side.charAt(0).toUpperCase() + side.slice(1).toLowerCase();
  
    try {
      const tradeQuerySnapshot = await db
        .collection("traders")
        .doc(trader)
        .collection("trades")
        .where("symbol", "==", symbol)
        .where("exchange", "==", exchange)
        .where("side", "==", formattedSide) // Use the reformatted side in the query
        .orderBy("created_at", "desc")
        .limit(1)
        .get();
  
      if (tradeQuerySnapshot.empty) {
        console.log(
          `No trade document found for trader ${trader}, symbol ${symbol}, exchange ${exchange}, and side ${formattedSide}`
        );
        return null;
      }
  
      const tradeDoc = tradeQuerySnapshot.docs[0];
      return tradeDoc;
    } catch (error) {
      console.error("Error fetching trade document:", error);
      return null;
    }
  }

  module.exports = { mapPositionToTrade, getTradeDoc };