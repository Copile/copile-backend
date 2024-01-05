const { Firestore } = require("@google-cloud/firestore");
const CustomError = require("./error");
const createSession = require("../exchanges/sessionFactory");

const db = new Firestore();

const STATUS = {
  QUEUED: "Queued",
  CANCELLED: "Cancelled",
  UNKNOWN: "Unknown",
};

const EXCHANGE = {
  BINANCE: "binance",
  KUCOIN: "kucoin",
  BINGX: "bingx",
  TESTNET: "testnet",
};

/**
 * Retrieves detailed information on trade profits and losses for a specific trader and trade.
 * @async
 * @param {string} traderId - The identifier for the trader.
 * @param {string} tradeId - The identifier for the trade.
 * @param {string} exchange - The name of the exchange platform.
 * @param {string} [apiKey] - The API key for the exchange.
 * @param {string} [apiSecret] - The API secret for the exchange.
 * @param {string} [apiPassphrase] - The API passphrase for the exchange.
 * @returns {Promise<Object>} An object containing arrays of take profit and stop loss details.
 * @throws {CustomError} Throws a custom error if the operation fails.
 */
async function getTradeProfitLossDetails(
  traderId,
  tradeId,
  exchange,
  // Second1 adjustment
  // symbol,
  apiKey = null,
  apiSecret = null,
  apiPassphrase = null
) {
  try {
    const tradeDocRef = db
      .collection("traders")
      .doc(traderId)
      .collection("trades")
      .doc(tradeId);

    // Second1 adjustment
    // Fetch the trade data
    const tradeDoc = await tradeDocRef.get();
    const tradeData = tradeDoc.data();

    // Extract the symbol from the trade data
    const symbol = tradeData.symbol;

    // Fetch take-profits and stop-losses
    const [takeProfitQuerySnapshot, stopLossQuerySnapshot] = await Promise.all([
      tradeDocRef.collection("take-profits").get(),
      tradeDocRef.collection("stop-losses").get(),
    ]);

    if (takeProfitQuerySnapshot.empty && stopLossQuerySnapshot.empty) {
      return;
    }

    let takeProfitData = [];
    let stopLossData = [];

    takeProfitQuerySnapshot.forEach((doc) => {
      const data = doc.data();
      data.tp_price = data.tp_value;
      delete data.tp_value;
      data.tp_id = doc.id;
      takeProfitData.push(data);
    });

    stopLossQuerySnapshot.forEach((doc) => {
      const data = doc.data();
      data.sl_price = data.sl_value;
      delete data.sl_value;
      data.sl_id = doc.id;
      stopLossData.push(data);
    });

    // Get active orders once for both takeProfit and stopLoss
    const activeOrders = await getActiveOrders(
      apiKey,
      apiSecret,
      apiPassphrase,
      exchange,
      symbol
    );
    console.log("activeOrders", activeOrders);
    if (!activeOrders) return;

    const [takeProfitNewData, stopLossNewData] = await Promise.all([
      checkTakeProfitStatus(exchange, takeProfitData, activeOrders),
      checkStopLossStatus(exchange, stopLossData, activeOrders),
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
    if (error instanceof CustomError) {
      throw error;
    }
    throw new CustomError({
      message: `Failed to get trade profit/loss details: ${error.message}`,
      status: 400,
      source: "getTradeProfitLossDetails",
    });
  }
}

/**
 * Retrieves active orders for a specific exchange.
 * @async
 * @param {string} exchange - The name of the exchange platform.
 * @param {string} apiKey - The API key for the exchange.
 * @param {string} apiSecret - The API secret for the exchange.
 * @param {string} apiPassphrase - The API passphrase for the exchange.
 * @returns {Promise<Array>} An array of active orders.
 * @throws {CustomError} Throws a custom error if the operation fails.
 */
async function getActiveOrders(
  apiKey,
  apiSecret,
  apiPassphrase,
  exchange,
  symbol
) {
  try {
    const session = createSession(exchange, apiKey, apiSecret, apiPassphrase);
    return await session.getOrderStatuses(symbol);
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }
    throw new CustomError({
      message: `Failed to get active orders: ${error.message}`,
      status: 400,
      source: "getActiveOrders",
    });
  }
}

async function checkOrderStatus(activeOrders, orderID, price, exchange) {
  let foundOrder = activeOrders.find((order) => {
    if (exchange === EXCHANGE.BINANCE && order.symbol === "ETHUSDT") {
      return Number(order.price).toFixed(2) === Number(price).toFixed(2);
    }
    return String(order.orderId) === String(orderID);
  });

  return foundOrder ? foundOrder.status : STATUS.QUEUED;
}

/**
 * Checks the status of take profit orders and returns updated data.
 * @async
 * @param {string} exchange - The name of the exchange platform.
 * @param {Array} takeProfitData - An array of take profit orders.
 * @param {Array} activeOrders - An array of active orders fetched once.
 * @returns {Promise<Array>} An updated array of take profit orders with status.
 */
async function checkTakeProfitStatus(exchange, takeProfitData, activeOrders) {
  const promises = takeProfitData.map(async (tp) => {
    if (tp.executed === "0") {
      tp.tp_status = STATUS.QUEUED;
    } else if (tp.executed === "1") {
      tp.tp_status = await checkOrderStatus(
        activeOrders,
        tp.orderID,
        tp.tp_price,
        exchange
      );
    } else if (tp.executed === "2") {
      tp.tp_status = STATUS.CANCELLED;
    }
    return tp;
  });

  return Promise.all(promises);
}

/**
 * Checks the status of stop loss orders and returns updated data.
 * @async
 * @param {string} exchange - The name of the exchange platform.
 * @param {Array} stopLossData - An array of stop loss orders.
 * @param {Array} activeOrders - An array of active orders fetched once.
 * @returns {Promise<Array>} An updated array of stop loss orders with status.
 */
async function checkStopLossStatus(exchange, stopLossData, activeOrders) {
  const promises = stopLossData.map(async (sl) => {
    if (sl.executed === "0") {
      sl.sl_status = STATUS.QUEUED;
    } else if (sl.executed === "1") {
      sl.sl_status = await checkOrderStatus(
        activeOrders,
        sl.orderID,
        sl.sl_price,
        exchange
      );
    } else if (sl.executed === "2") {
      sl.sl_status = STATUS.CANCELLED;
    }
    return sl;
  });

  return Promise.all(promises);
}

module.exports = {
  getTradeProfitLossDetails,
  checkOrderStatus,
  checkTakeProfitStatus,
  checkStopLossStatus,
};
