const express = require('express');
const { Firestore } = require('@google-cloud/firestore');
const { ContractClient } = require('bybit-api');
const api = require("kucoin-futures-node-api");
const { getPositions, getOrder, getOrders } = require('./bingxrequest');
const decryptData = require('./decryption');

const db = new Firestore();
const applyMiddleware = require('./middleware');
const app = express();
applyMiddleware(app);

app.all('/trades/:exchange', async (req, res) => {
    const user = req.get('userId');
    const exchange = req.params.exchange;
    const page = 1;
    const limit = 10;

    if (!user) {
        return res.status(400).json({ success: false, error: 'User name is missing' });
    }

    try {

        // Fetch userDoc and exchangesData in parallel
        const [userDoc, exchangesData] = await Promise.all([
        db.collection('users').doc(user).get(),
        db.collection('users').doc(user).get().then(doc => doc.data().exchanges || {})
        ]);

        if (!userDoc.exists) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        if (!exchangesData || !(exchange in exchangesData)) {
            return res.status(404).json({ success: false, error: 'No exchange found' });
        }

        const keys = exchangesData[exchange];
        if (!('api_key' in keys && keys.api_key !== 'x')) {
            return res.status(404).json({ success: false, error: 'API key not found for the exchange' });
        }

        const apiKey = keys.api_key;
        const apiSecret = await decryptData(keys.api_secret, user) || null;

        let apiPassphrase = null;
        if ('api_passphrase' in keys) {
            apiPassphrase = await decryptData(keys.api_passphrase, user) || null;
        }

        if (exchange === 'kucoin' && apiPassphrase === null) {
            return res.status(400).json({ success: false, error: 'Kucoin requires a passphrase' });
        }

        let trades;
        let orders;

        // Fetch trades and orders in parallel using Promise.all
        switch (exchange) {
        case 'kucoin':
            [trades, orders] = await Promise.all([
            getKucoinTrades(apiKey, apiSecret, apiPassphrase, user),
            getKucoinOrders(apiKey, apiSecret, apiPassphrase, user)
            ]);
            break;
        case 'bingx':
            [trades, orders] = await Promise.all([
            getBingXTrades(apiKey, apiSecret, user),
            getBingXOrders(apiKey, apiSecret, user)
            ]);
            break;
        default:
            console.log(`Unknown exchange: ${exchange}`);
            trades = [];
            orders = [];
        }

        // Pagination
        const start = (page - 1) * limit;
        const end = start + limit;
        const paginatedTrades = trades.slice(start, end);

        return res.json({ success: true, exchange: exchange, trades: paginatedTrades, orders: orders });

    } catch (e) {
        return res.status(500).json({ success: false, error: 'An error occurred while fetching the balance details.' });
    }
});

 app.all('/order/:exchange/:symbol/:tradeId', async (req, res) => {
    try {
        const tradeId = req.params.tradeId;
        const exchange = req.params.exchange;
        const symbol = req.params.symbol;
        const userId = req.get('userId');

        // Fetch userDoc and exchangesData in parallel
        const [userDoc, exchangesData] = await Promise.all([
        db.collection('users').doc(userId).get(),
        db.collection('users').doc(userId).get().then(doc => doc.data().exchanges || {})
        ]);

        if (!userDoc.exists) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        if (!exchangesData || !(exchange in exchangesData)) {
            return res.status(404).json({ success: false, error: 'No exchange found' });
        }

        const keys = exchangesData[exchange];
        if (!('api_key' in keys && keys.api_key !== 'x')) {
            return res.status(404).json({ success: false, error: 'API key not found for the exchange' });
        }

        const apiKey = keys.api_key;
        const apiSecret = await decryptData(keys.api_secret, userId) || null;

        let apiPassphrase = null;
        if ('api_passphrase' in keys) {
            apiPassphrase = await decryptData(keys.api_passphrase, userId) || null;
        }


        if (exchange === 'kucoin' && apiPassphrase === null) {
            return res.status(400).json({ success: false, error: 'Kucoin requires a passphrase' });
        }

        const details = await getTradeProfitLossDetails(userId, tradeId, exchange, symbol, apiKey, apiSecret, apiPassphrase);

        if (details) {
            res.json(details);
        } else {
            res.status(404).send(`Trade with ID ${tradeId} not found.`);
        }
    } catch (error) {
        console.log(error);
        res.status(500).send('An error occurred while fetching the trade details.');
    }
});

async function mapPositionToTrade(position, userId, symbol, exchange, side) {
  // Fetch the trade id
  const tradeQuerySnapshot = await db
    .collection('users')
    .doc(userId)
    .collection('trades')
    .where('symbol', '==', symbol)
    .where('exchange', '==', exchange)
    .where('side', '==', side)
    .orderBy('created_at', 'desc')
    .limit(1)
    .get();

  if (tradeQuerySnapshot.empty != false) {
    console.log(`No trade document found for user ${userId}, symbol ${symbol}, exchange ${exchange}, and side ${side}`);
    return;
  }
  const tradeDoc = tradeQuerySnapshot.docs[0];
  const tradeData = tradeDoc.data(); // Get data from the trade document

  // Fetch details from the position object
  let isIsolated = position.tradeMode === 1 ? 'isolated' : 'cross';

  return {
    trade_id: tradeDoc.id, // Use the fetched trade id
    symbol: position.symbol,
    side: position.side,
    margin_mode: isIsolated,
    leverage: position.leverage,
    quantity: String(position.size),
    margin: position.margin,
    entry_price: position.entryPrice,
    unrealised_pnl: position.unrealised_pnl,
    unrealised_pnl_pct: position.unrealised_pnl_pct,
    realised_pnl: position.realised_pnl,
    created_at: tradeData.created_at // Include the 'created_at' field from the trade document
  };
}

async function getBybitTrades(apiKey, apiSecret, userId) {
    try {
        const client = new ContractClient({
            key: apiKey,
            secret: apiSecret,
            strict_param_validation: true,
        });

        const positionData = await client.getPositions({
            settleCoin: 'USDT',
        });

        const trades = positionData.result.list
            .filter(position => position.size !== 0)
            .map(async position => {
                let margin = position.positionBalance;
                position.unrealised_pnl_pct = String(((position.unrealisedPnl * 100) / margin).toFixed(2));
                return await mapPositionToTrade(position, userId, position.symbol, "bybit", position.side);
            });
        return await Promise.all(trades);
    } catch (e) {
        console.log(`An error occurred while retrieving trades from Bybit. Error message: ${e}`);
        return [];
    }
}

async function getKucoinTrades(apiKey, apiSecret, apiPassphrase, userId) {
    try {
        const config = {
            apiKey: apiKey,
            secretKey: apiSecret,
            passphrase: apiPassphrase,
            environment: "live",
        };

        const apiLive = new api();
        apiLive.init(config);

        let positions = await apiLive.getAllPositions();
        positions = positions.data;

        const trades = positions
            .filter(position => position.size !== 0)
            .map(async position => {
                position.side = position.currentQty < 0 ? "Sell" : "Buy";
                position.margin_mode = position.crossMode === true ? "cross" : "isolated";
                if (position.currentQty < 0 && position.currentCost < 0) {
                    position.currentQty *= -1;
                    position.currentCost *= -1;
                }
                position.leverage = position.realLeverage;
                position.unrealised_pnl = position.unrealisedPnl;
                position.margin = position.maintMargin;
                position.unrealised_pnl_pct = String((parseFloat(position.unrealisedPnlPcnt) * 100 * parseFloat(position.realLeverage)).toFixed(2));
                position.entryPrice = position.avgEntryPrice;
                position.realised_pnl = position.realisedPnl;
                position.size = position.currentQty;

                return await mapPositionToTrade(position, userId, position.symbol, "kucoin", position.side);
            });

        return await Promise.all(trades);

    } catch (e) {
        console.log(`An error occurred while retrieving trades from KuCoin. Error message: ${e}`);
        return [];
    }
}

async function getBingXTrades(apiKey, apiSecret, userId) {
    try {
        const positions = await getPositions(apiKey, apiSecret);
        const trades = positions
            .filter(position => position.positionAmt !== 0)
            .map(async position => {
                position.side = position.positionSide === "LONG" ? "Buy" : "Sell";
                position.margin_mode = position.isolated === true ? "isolated" : "cross";
                position.unrealised_pnl = position.unrealizedProfit;
                position.positionBalance = parseFloat(position.positionAmt) * parseFloat(position.avgPrice);
                position.margin = String(parseFloat(position.initialMargin) - parseFloat(position.unrealizedProfit));
                position.entryPrice = position.avgPrice;
                position.realised_pnl = position.realisedProfit;
                position.size = position.positionAmt;
                position.unrealised_pnl_pct = String(((parseFloat(position.unrealizedProfit) / (parseFloat(position.positionAmt) * parseFloat(position.avgPrice))) * 100 * parseFloat(position.leverage)).toFixed(2));

                return await mapPositionToTrade(position, userId, position.symbol, "bingx", position.side);
            });

        return await Promise.all(trades);
    } catch (e) {
        console.log(`An error occurred while retrieving trades from BingX. Error message: ${e}`);
        return [];
    }
}

async function getTradeProfitLossDetails(user, tradeId, exchange, symbol, apiKey, apiSecret, apiPassphrase = null) {
  try {
    const tradeDocRef = db.collection('users').doc(user).collection('trades').doc(tradeId);

    const takeProfitQuerySnapshot = await tradeDocRef.collection('take-profits').get();
    let takeProfitData = [];

    takeProfitQuerySnapshot.forEach((doc) => {
      const data = doc.data();
      data.tp_price = data.tp_value; // Rename tp_value to tp_price
      delete data.tp_value; // Remove tp_value field
      data.tp_id = doc.id; // Add tp_id field with the document ID
      takeProfitData.push(data);
    });

    const stopLossQuerySnapshot = await tradeDocRef.collection('stop-losses').get();
    let stopLossData = [];

    stopLossQuerySnapshot.forEach((doc) => {
      const data = doc.data();
      data.sl_price = data.sl_value; // Rename sl_value to sl_price
      delete data.sl_value; // Remove sl_value field
      data.sl_id = doc.id; // Add sl_id field with the document ID
      stopLossData.push(data);
    });

    const [takeProfitNewData, stopLossNewData] = await Promise.all([
      checkTakeProfitStatus(exchange, symbol, takeProfitData, apiKey, apiSecret, apiPassphrase),
      checkStopLossStatus(exchange, symbol, stopLossData, apiKey, apiSecret, apiPassphrase)
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
      stop_losses: stopLossData,
    };
  } catch (error) {
    console.error('Error retrieving trade document:', error);
    return null;
  }
}

async function checkTakeProfitStatus(exchange, symbol, takeProfitData, apiKey, apiSecret, apiPassphrase = null) {
  for (const tp of takeProfitData) {
    if (tp.executed === "0") {
      tp.tp_status = "Queued";
    } else if (tp.executed === "1") {
      let status = await getOrderStatus(exchange, symbol, tp.orderID, apiKey, apiSecret, apiPassphrase);
      tp.tp_status = status;
    } else if (tp.executed === "2") {
      tp.tp_status = "Cancelled";
    }
  }
  return takeProfitData;
}

async function checkStopLossStatus(exchange, symbol, stopLossData, apiKey, apiSecret, apiPassphrase = null) {
  for (const sl of stopLossData) {
    if (sl.executed === "0") {
      sl.sl_status = "Queued";
    } else if (sl.executed === "1") {
      let status = await getOrderStatus(exchange, symbol, sl.orderID, apiKey, apiSecret, apiPassphrase);
      sl.sl_status = status;
    } else if (sl.executed === "2") {
      sl.sl_status = "Cancelled";
    }
  }
  return stopLossData;
}

async function getOrderById(exchange, orderID, apiKey, apiSecret, apiPassphrase = null) {
    switch (exchange) {
        case 'bybit':
            return await getBybitOrderById(orderID, apiKey, apiSecret);
        case 'kucoin':
            return await getKucoinOrderById(orderID, apiKey, apiSecret, apiPassphrase);
        case 'bingx':
            return await getBingXOrderById(orderID, apiKey, apiSecret);
        default:
            console.log(`Unknown exchange: ${exchange}`);
            return null;
    }
}

async function getOrderStatus(exchange, symbol, orderID, apiKey, apiSecret, apiPassphrase = null) {
  switch (exchange) {
    case 'kucoin':
      const kucoin_order = await getKucoinOrderById(symbol, orderID, apiKey, apiSecret, apiPassphrase);
      return kucoin_order.status === "done" ? "Filled" : "Active";
    case 'bingx':
      const bingx_order = await getBingXOrderById(symbol, orderID, apiKey, apiSecret);
      return bingx_order === 'NEW' ? 'Active' : bingx_order;
    default:
      console.log(`Unknown exchange: ${exchange}`);
      return null;
  }
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
        console.log(`An error occurred while retrieving an order by ID from Bybit. Error message: ${e}`);
        return null;
    }
}

async function getKucoinOrderById(symbol, orderID, apiKey, apiSecret, apiPassphrase) {
    try {
        const config = {
            apiKey: apiKey,
            secretKey: apiSecret,
            passphrase: apiPassphrase,
            environment: "live",
        };
        const apiLive = new api();
        apiLive.init(config);
        let order = await apiLive.getOrderById({ oid: orderID });
        console.log(order.data);
        return order.data;
    }
    catch (e) {
        console.log(`An error occurred while retrieving an order by ID from KuCoin. Error message: ${e}`);
        return null;
    }
}

async function getBingXOrderById(symbol, orderID, apiKey, apiSecret) {
    try {
        const order = await getOrder(apiKey, apiSecret, symbol, orderID);
        return order;
    } catch (e) {
        console.log(`An error occurred while retrieving an order by ID from BingX. Error message: ${e}`);
        return null;
    }
}

async function getBybitOrders(apiKey, apiSecret) {
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
        return orders.result.list;
    } catch (e) {
        console.error(`An error occurred while retrieving active orders from Bybit. Error message: ${e}`);
        return [];
    }
}

async function getKucoinOrders(apiKey, apiSecret, apiPassphrase, user) {
    try {
        const config = {
            apiKey: apiKey,
            secretKey: apiSecret,
            passphrase: apiPassphrase,
            environment: "live",
        };
        const apiLive = new api();
        apiLive.init(config);
        let orders = await apiLive.getOrders({
            status: "active",
        });

        // Filter the orders to only show type "limit", reduceOnly false, and status "open"
        const filteredOrders = orders.data.items.filter(order => 
            order.type === "limit" && 
            order.reduceOnly === false && 
            order.status === "open"
        );

        // Extract matching parameters for KuCoin
        const kucoinMatchingParams = await Promise.all(filteredOrders.map(async order => {
          const tradeDoc = await getTradeDoc(user, order.symbol, "kucoin", order.side);
          const tradeData = tradeDoc.data();
          return {
            trade_id: tradeDoc.id,
            symbol: order.symbol,
            side: order.side,
            leverage: tradeData.leverage,
            margin: tradeData.margin,
            type: "LIMIT",
            entry_price: order.price,
            quantity: order.size,
            status: "Active",
            created_at: tradeData.created_at
          };
        }));

        return kucoinMatchingParams;
    } catch (e) {
        console.error(`An error occurred while retrieving active orders from KuCoin. Error message: ${e}`);
        return [];
    }
}

async function getBingXOrders(apiKey, apiSecret, user) {
  try {
    const orders = await getOrders(apiKey, apiSecret);

    const bingxMatchingParams = await Promise.all(orders.map(async order => {
      const tradeDoc = await getTradeDoc(user, order.symbol, "bingx", order.side);
      const tradeData = tradeDoc.data();
      return {
        trade_id: tradeDoc.id,
        symbol: order.symbol,
        side: order.side,
        leverage: tradeData.leverage,
        margin: tradeData.margin,
        type: "LIMIT",
        entry_price: order.price,
        quantity: order.origQty,
        status: "Active",
        created_at: tradeData.created_at
      };
    }));

    return bingxMatchingParams;
  } catch (e) {
    console.error(`An error occurred while retrieving active orders from BingX. Error message: ${e}`);
    return [];
  }
}

async function getTradeDoc(user, symbol, exchange, side) {
  // Reformat the side variable to have the first letter capital and the rest lowercase
  const formattedSide = side.charAt(0).toUpperCase() + side.slice(1).toLowerCase();

  try {
    const tradeQuerySnapshot = await db
      .collection('users')
      .doc(user)
      .collection('trades')
      .where('symbol', '==', symbol)
      .where('exchange', '==', exchange)
      .where('side', '==', formattedSide) // Use the reformatted side in the query
      .orderBy('created_at', 'desc')
      .limit(1)
      .get();

    if (tradeQuerySnapshot.empty) {
      console.log(`No trade document found for user ${user}, symbol ${symbol}, exchange ${exchange}, and side ${formattedSide}`);
      return null;
    }

    const tradeDoc = tradeQuerySnapshot.docs[0];
    return tradeDoc;
  } catch (error) {
    console.error('Error fetching trade document:', error);
    return null;
  }
}


exports.trades = app;
