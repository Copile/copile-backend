const express = require("express");
const { Firestore } = require("@google-cloud/firestore");
const { ContractClient } = require("bybit-api");
const decryptData = require("./decryption");
const axios = require("axios");

const db = new Firestore();
const applyMiddleware = require("./middleware");
const app = express();
applyMiddleware(app);

app.all("/trades", async (req, res) => {
  const user = req.get("userId");
  const trader = req.get("traderId");

  const entityId = user || trader;
  const entityCollection = user ? "users" : "traders";

  const entity = await getEntity(entityCollection, entityId);
  if (!entity) {
    return res.status(404).json({
      success: false,
      error: `${entityCollection.slice(0, -1)} not found`,
    });
  }

  const exchange = "bybit";
  const page = req.query.page || 1;
  const limit = req.query.limit || 10;

  try {
    const exchangesData = entity.exchanges || {};

    if (!exchangesData || !(exchange in exchangesData)) {
      return res
        .status(404)
        .json({ success: false, error: "No exchange found" });
    }

    const keys = exchangesData[exchange];
    if (!("api_key" in keys && keys.api_key !== "x")) {
      return res
        .status(404)
        .json({ success: false, error: "API key not found for the exchange" });
    }

    const apiKey = keys.api_key;
    const apiSecret = (await decryptData(keys.api_secret, entityId)) || null;

    let orders = [];
    let trades = [];

    [trades, orders] = await Promise.all([
      getBybitTrades(apiKey, apiSecret, entityCollection, entityId),
      getBybitOrders(apiKey, apiSecret, entityCollection, entityId),
    ]);

    // Pagination
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedTrades = trades.slice(start, end);

    return res.json({
      success: true,
      exchange: exchange,
      trades: paginatedTrades,
      orders: orders,
    });
  } catch (e) {
    return res.status(500).json({
      success: false,
      error: "An error occurred while fetching the trade details.",
    });
  }
});

// app.all('/order/:symbol/:tradeId', async (req, res) => {
app.all("/order", async (req, res) => {
  try {
    const user = req.get("userId");
    const trader = req.get("traderId");

    const entityId = user || trader;
    const entityCollection = user ? "users" : "traders";

    const entity = await getEntity(entityCollection, entityId);
    if (!entity) {
      return res.status(404).json({
        success: false,
        error: `${entityCollection.slice(0, -1)} not found`,
      });
    }

    // const tradeId = req.params.tradeId;
    const tradeIds = req.body.tradeIds;
    const exchange = "bybit";
    // const symbol = req.params.symbol;

    const exchangesData = entity.exchanges || {};

    if (!exchangesData || !(exchange in exchangesData)) {
      return res
        .status(404)
        .json({ success: false, error: "No exchange found" });
    }

    const keys = exchangesData[exchange];
    if (!("api_key" in keys && keys.api_key !== "x")) {
      return res
        .status(404)
        .json({ success: false, error: "API key not found for the exchange" });
    }

    const apiKey = keys.api_key;
    const apiSecret = (await decryptData(keys.api_secret, entityId)) || null;

    // const details = await getTradeProfitLossDetails(entityCollection, entityId, tradeId, exchange, symbol, apiKey, apiSecret);

    // Fetch details for all trades
    const detailsPromises = tradeIds.map((tradeId) =>
      getTradeProfitLossDetails(
        entityCollection,
        entityId,
        tradeId,
        exchange,
        apiKey,
        apiSecret
        // apiPassphrase
      )
    );
    const details = await Promise.all(detailsPromises);

    if (details) {
      res.json(details);
    } else {
      // res.status(404).send(`Trade with ID ${tradeId} not found.`);
      res.status(404).send(`Trade ID not found.`);
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while fetching the trade details.");
  }
});

app.all("/balance", async (req, res) => {
  const trader = req.get("traderId");

  if (!trader) {
    return res
      .status(400)
      .json({ success: false, error: "Trader ID is missing" });
  }

  try {
    const startTime = Date.now();

    const traderRef = db.collection("traders").doc(trader);
    const traderDoc = await traderRef.get();

    if (!traderDoc.exists) {
      return res
        .status(404)
        .json({ success: false, error: "Trader not found" });
    }

    const exchangesData = traderDoc.data().exchanges || {};

    if (!exchangesData || !("bybit" in exchangesData)) {
      return res.status(404).json({
        success: false,
        error: "No exchange found or unsupported exchange",
      });
    }

    const keys = exchangesData.bybit;
    if (!("api_key" in keys && keys.api_key !== "x")) {
      return res
        .status(404)
        .json({ success: false, error: "API key not found for the exchange" });
    }

    const apiKey = keys.api_key;
    const apiSecret = (await decryptData(keys.api_secret, trader)) || null;

    const balance = await getBybitBalance(apiKey, apiSecret);

    const endTime = Date.now();
    const executionTime = endTime - startTime;

    return res
      .status(200)
      .json({ success: true, balance: balance, executionTime });
  } catch (e) {
    return res.status(500).json({
      success: false,
      error: "An error occurred while fetching the balance details.",
    });
  }
});

// First endpoint: Forward traffic to "https://api.bybit.com/v5/market/instruments-info"
app.get("/symbolData", async (req, res) => {
  const trader = req.get("traderId");

  if (!trader) {
    return res
      .status(400)
      .json({ success: false, error: "Trader ID is missing" });
  }

  const traderRef = db.collection("traders").doc(trader);
  const traderDoc = await traderRef.get();

  if (!traderDoc.exists) {
    return res.status(404).json({ success: false, error: "Trader not found" });
  }

  const { symbol } = req.query;
  const url = `https://api.bybit.com/v5/market/instruments-info?category=linear&symbol=${symbol}`;

  try {
    const response = await axios.get(url);
    return res.json(response.data);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Failed to fetch data from the external API",
    });
  }
});

// Second endpoint: Forward traffic to "https://api.bybit.com/v2/public/symbols"
app.get("/supportedExchanges", async (req, res) => {
  const trader = req.get("traderId");

  if (!trader) {
    return res
      .status(400)
      .json({ success: false, error: "Trader ID is missing" });
  }

  const traderRef = db.collection("traders").doc(trader);
  const traderDoc = await traderRef.get();

  if (!traderDoc.exists) {
    return res.status(404).json({ success: false, error: "Trader not found" });
  }

  const url = "https://api.bybit.com/v2/public/symbols";

  try {
    const response = await axios.get(url);
    return res.json(response.data);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Failed to fetch data from the external API",
    });
  }
});

async function getEntity(collection, entityId) {
  const entityRef = db.collection(collection).doc(entityId);
  const entityDoc = await entityRef.get();

  if (!entityDoc.exists) {
    return null;
  }

  return entityDoc.data();
}

async function mapPositionToTrade(
  position,
  entityId,
  symbol,
  exchange,
  side,
  entityCollection
) {
  const tradeQuerySnapshot = await db
    .collection(entityCollection)
    .doc(entityId)
    .collection("trades")
    .where("symbol", "==", symbol)
    .where("exchange", "==", exchange)
    .where("side", "==", side)
    .orderBy("created_at", "desc")
    .limit(1)
    .get();
  if (tradeQuerySnapshot.empty != false) {
    console.log(
      `No trade document found for entity ${entityId}, symbol ${symbol}, exchange ${exchange}, and side ${side}`
    );
    return null;
  }

  const tradeDoc = tradeQuerySnapshot.docs[0];
  const tradeData = tradeDoc.data();

  let isIsolated = position.tradeMode === 1 ? "isolated" : "cross";

  return {
    trade_id: tradeDoc.id, // Use the fetched trade id
    symbol: position.symbol,
    side: position.side,
    margin_mode: isIsolated,
    leverage: position.leverage,
    quantity: String(position.size),
    margin: position.positionBalance,
    entry_price: position.entryPrice,
    unrealised_pnl: position.unrealisedPnl,
    unrealised_pnl_pct: position.unrealised_pnl_pct,
    realised_pnl: position.cumRealisedPnl,
    created_at: tradeData.created_at,
  };
}

async function getBybitTrades(apiKey, apiSecret, entityCollection, entityId) {
  try {
    const client = new ContractClient({
      key: apiKey,
      secret: apiSecret,
      strict_param_validation: true,
    });

    const positionData = await client.getPositions({
      settleCoin: "USDT",
    });

    if (!positionData || !positionData.result || !positionData.result.list) {
      return [];
    }

    const trades = positionData.result.list
      .filter((position) => position.size !== 0)
      .map(async (position) => {
        let margin = position.positionBalance;
        position.unrealised_pnl_pct = String(
          ((position.unrealisedPnl * 100) / margin).toFixed(2)
        );
        return await mapPositionToTrade(
          position,
          entityId,
          position.symbol,
          "bybit",
          position.side,
          entityCollection
        );
      });
    return await Promise.all(trades);
  } catch (e) {
    console.log(e);
    return [];
  }
}

// async function getTradeProfitLossDetails(entityCollection, entityId, tradeId, exchange, symbol, apiKey, apiSecret) {
async function getTradeProfitLossDetails(
  entityCollection,
  entityId,
  tradeId,
  exchange,
  apiKey,
  apiSecret
) {
  try {
    const tradeDocRef = db
      .collection(entityCollection)
      .doc(entityId)
      .collection("trades")
      .doc(tradeId);

    // Second1 adjustment
    // Fetch the trade data
    const tradeDoc = await tradeDocRef.get();
    const tradeData = tradeDoc.data();

    // Extract the symbol from the trade data
    const symbol = tradeData.symbol;

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

    takeProfitData = await checkTakeProfitStatus(
      exchange,
      symbol,
      takeProfitData,
      apiKey,
      apiSecret
    );
    stopLossData = await checkStopLossStatus(
      exchange,
      symbol,
      stopLossData,
      apiKey,
      apiSecret
    );

    // Remove orderID field
    takeProfitData.forEach((data) => {
      delete data.orderID;
    });

    stopLossData.forEach((data) => {
      delete data.orderID;
    });

    return {
      take_profits: takeProfitData,
      stop_losses: stopLossData,
    };
  } catch (error) {
    console.error("Error retrieving trade document:", error);
    return null;
  }
}

async function checkTakeProfitStatus(
  exchange,
  symbol,
  takeProfitData,
  apiKey,
  apiSecret
) {
  for (const tp of takeProfitData) {
    if (tp.executed === "0") {
      tp.tp_status = "Queued";
    } else if (tp.executed === "1") {
      console.log(tp);
      let status = await getOrderStatus(
        exchange,
        symbol,
        tp.orderID,
        apiKey,
        apiSecret
      );
      tp.tp_status = status === undefined ? "Filled" : status["orderStatus"];
    } else if (tp.executed === "2") {
      tp.tp_status = "Cancelled";
    }
  }
  return takeProfitData;
}

async function checkStopLossStatus(
  exchange,
  symbol,
  stopLossData,
  apiKey,
  apiSecret
) {
  for (const sl of stopLossData) {
    if (sl.executed === "0") {
      sl.sl_status = "Queued";
    } else if (sl.executed === "1") {
      let status = await getOrderStatus(
        exchange,
        symbol,
        sl.orderID,
        apiKey,
        apiSecret
      );
      sl.sl_status = status === undefined ? "Filled" : status["orderStatus"];
    } else if (sl.executed === "2") {
      sl.sl_status = "Cancelled";
    }
  }
  return stopLossData;
}

async function getOrderStatus(exchange, symbol, orderID, apiKey, apiSecret) {
  const bybit_order = await getBybitOrderById(
    symbol,
    orderID,
    apiKey,
    apiSecret
  );

  if (bybit_order["orderStatus"] === "Untriggered") {
    bybit_order["orderStatus"] = "Active";
  }

  return bybit_order;
}

async function getBybitOrderById(symbol, orderID, apiKey, apiSecret) {
  try {
    const client = new ContractClient({
      key: apiKey,
      secret: apiSecret,
      strict_param_validation: true,
    });
    let order = await client.getActiveOrders({
      orderId: orderID,
      symbol: symbol,
    });
    return order.result.list[0];
  } catch (e) {
    console.log(e);
    return null;
  }
}

async function getBybitBalance(apiKey, apiSecret) {
  try {
    const client = new ContractClient({
      key: apiKey,
      secret: apiSecret,
      strict_param_validation: true,
    });
    const balance = await client.getBalances((coin = "USDT"));
    console.log(balance);
    return balance.result.list[0].availableBalance;
  } catch (e) {
    console.log("Error in getBybitBalance: ", e);
    return [];
  }
}

async function getBybitOrders(apiKey, apiSecret, entityCollection, entityId) {
  try {
    const client = new ContractClient({
      key: apiKey,
      secret: apiSecret,
      strict_param_validation: true,
    });
    let orders = await client.getActiveOrders({
      orderFilter: "order",
      settleCoin: "USDT",
    });

    if (!orders || !orders.result || !orders.result.list) {
      return [];
    }

    // Filter the orders to only show reduceOnly false and orderStatus "New"
    const filteredOrders = orders.result.list.filter(
      (order) => order.reduceOnly === false && order.orderStatus === "New"
    );

    const bybitMatchingParams = await Promise.all(
      filteredOrders.map(async (order) => {
        const tradeDoc = await getTradeDoc(
          entityCollection,
          entityId,
          order.symbol,
          "bybit",
          order.side
        );
        const tradeData = tradeDoc.data();
        return {
          trade_id: tradeDoc.id,
          symbol: order.symbol,
          side: order.side,
          leverage: tradeData.leverage,
          margin: tradeData.margin,
          type: "LIMIT",
          entry_price: order.price,
          quantity: order.qty,
          orderStatus: "Active",
          created_at: tradeData.created_at,
        };
      })
    );

    return bybitMatchingParams;
  } catch (e) {
    console.error(
      `An error occurred while retrieving active orders from Bybit. Error message: ${e}`
    );
    return [];
  }
}

async function getTradeDoc(entityCollection, entityId, symbol, exchange, side) {
  // Reformat the side variable to have the first letter capital and the rest lowercase
  const formattedSide =
    side.charAt(0).toUpperCase() + side.slice(1).toLowerCase();

  try {
    const tradeQuerySnapshot = await db
      .collection(entityCollection)
      .doc(entityId)
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

exports.trades = app;
