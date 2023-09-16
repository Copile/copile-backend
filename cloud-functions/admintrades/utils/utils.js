const { Firestore } = require("@google-cloud/firestore");

const { BinanceSession } = require("../exchanges/binance/session");
const { KuCoinSession } = require("../exchanges/kucoin/session");
const { BingXSession } = require("../exchanges/bingx/session");

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

async function getTradeProfitLossDetails(
  trader,
  tradeId,
  exchange,
  symbol,
  apiKey,
  apiSecret,
  apiPassphrase = null
) {
  try {
    const tradeDocRef = db
      .collection("traders")
      .doc(trader)
      .collection("trades")
      .doc(tradeId);

    const takeProfitQuerySnapshot = await tradeDocRef
      .collection("take-profits")
      .get();
    let takeProfitData = [];

    takeProfitQuerySnapshot.forEach((doc) => {
      const data = doc.data();
      data.tp_price = data.tp_value; // Rename tp_value to tp_price
      delete data.tp_value; // Remove tp_value field
      data.tp_id = doc.id; // Add tp_id field with the document ID
      takeProfitData.push(data);
    });

    const stopLossQuerySnapshot = await tradeDocRef
      .collection("stop-losses")
      .get();
    let stopLossData = [];

    stopLossQuerySnapshot.forEach((doc) => {
      const data = doc.data();
      data.sl_price = data.sl_value; // Rename sl_value to sl_price
      delete data.sl_value; // Remove sl_value field
      data.sl_id = doc.id; // Add sl_id field with the document ID
      stopLossData.push(data);
    });

    const [takeProfitNewData, stopLossNewData] = await Promise.all([
      checkTakeProfitStatus(
        exchange,
        symbol,
        takeProfitData,
        apiKey,
        apiSecret,
        apiPassphrase
      ),
      checkStopLossStatus(
        exchange,
        symbol,
        stopLossData,
        apiKey,
        apiSecret,
        apiPassphrase
      ),
    ]);

    // Remove orderID field
    takeProfitNewData.forEach((data) => {
      delete data.orderID;
    });

    stopLossNewData.forEach((data) => {
      delete data.orderID;
    });

    return {
      take_profits: takeProfitNewData,
      stop_losses: stopLossNewData,
    };
  } catch (error) {
    console.error("Error retrieving trade document:", error);
    return null;
  }
}

async function checkOrderStatus(activeOrders, orderID) {
  const foundOrder = await activeOrders.find(
    (order) => order.order_id === orderID
  );
  return foundOrder.status;
}

async function checkTakeProfitStatus(
  exchange,
  symbol,
  takeProfitData,
  apiKey,
  apiSecret,
  apiPassphrase = null
) {
  let activeOrders = [];
  switch (exchange) {
    case "kucoin":
      const kucoinSession = new KuCoinSession({
        apiKey,
        apiSecret,
        apiPassphrase,
      });
      activeOrders = await kucoinSession.getOrderStatuses();
      break;
    case "bingx":
      const bingxSession = new BingXSession({ apiKey, apiSecret });
      activeOrders = await bingxSession.getOrderStatuses();
      break;
    case "binance":
      const binanceSession = new BinanceSession({ apiKey, apiSecret });
      activeOrders = await binanceSession.getOrderStatuses();
      break;
    default:
      console.log(`Unknown exchange: ${exchange}`);
      return [];
  }

  const promises = takeProfitData.map(async (tp) => {
    if (tp.executed === "0") {
      tp.tp_status = "Queued";
    } else if (tp.executed === "1") {
      tp.tp_status = await checkOrderStatus(
        activeOrders,
        tp.orderID
      );
    } else if (tp.executed === "2") {
      tp.tp_status = "Cancelled";
    }
    return tp;
  });

  return Promise.all(promises);
}

async function checkStopLossStatus(
  exchange,
  symbol,
  stopLossData,
  apiKey,
  apiSecret,
  apiPassphrase = null
) {
  let activeOrders = [];
  switch (exchange) {
    case "kucoin":
      const kucoinSession = new KuCoinSession({
        apiKey,
        apiSecret,
        apiPassphrase,
      });
      activeOrders = await kucoinSession.getOrderStatuses();
      break;
    case "bingx":
      const bingxSession = new BingXSession({ apiKey, apiSecret });
      activeOrders = await bingxSession.getOrderStatuses();
      break;
    case "binance":
      const binanceSession = new BinanceSession({ apiKey, apiSecret });
      activeOrders = await binanceSession.getOrderStatuses();
      break;
    default:
      console.log(`Unknown exchange: ${exchange}`);
      return [];
  }

  const promises = stopLossData.map(async (sl) => {
    if (sl.executed === "0") {
      sl.sl_status = "Queued";
    } else if (sl.executed === "1") {
      sl.sl_status = await checkOrderStatus(
        activeOrders,
        sl.orderID
      );
    } else if (sl.executed === "2") {
      sl.sl_status = "Cancelled";
    }
    return sl;
  });

  return Promise.all(promises);
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

module.exports = {
  mapPositionToTrade,
  getTradeProfitLossDetails,
  checkOrderStatus,
  checkTakeProfitStatus,
  checkStopLossStatus,
  getTradeDoc,
};
