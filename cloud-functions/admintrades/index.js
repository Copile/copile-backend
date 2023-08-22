const express = require('express');
const { Firestore } = require('@google-cloud/firestore');
const api = require("kucoin-futures-node-api");
const { getPositions, getOrder, getOrders, getBalance } = require('./bingxrequest');
const decryptData = require('./decryption');

const db = new Firestore();
const applyMiddleware = require('./middleware');
const app = express();
applyMiddleware(app);

app.all('/trades/:exchange', async (req, res) => {
  try {
    const trader = req.get('traderId');
    const exchange = req.params.exchange;
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;

    if (!trader) {
      return res.status(400).json({ success: false, error: 'Trader name is missing' });
    }

    // Fetch userDoc and exchangesData in parallel
    const [userDoc, exchangesData] = await Promise.all([
      db.collection('traders').doc(trader).get(),
      db.collection('traders').doc(trader).get().then(doc => doc.data().exchanges || {})
    ]);

    if (!userDoc.exists) {
      return res.status(404).json({ success: false, error: 'Trader not found' });
    }

    if (!exchangesData || !(exchange in exchangesData)) {
      return res.status(404).json({ success: false, error: 'No exchange found' });
    }

    const keys = exchangesData[exchange];
    if (!('api_key' in keys && keys.api_key !== 'x')) {
      return res.status(404).json({ success: false, error: 'API key not found for the exchange' });
    }

    const apiKey = keys.api_key;
    const apiSecret = await decryptData(keys.api_secret, trader) || null;
    
    let apiPassphrase = null;
    if ('api_passphrase' in keys) {
      apiPassphrase = await decryptData(keys.api_passphrase, trader);
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
          getKucoinTrades(apiKey, apiSecret, apiPassphrase, trader),
          getKucoinOrders(apiKey, apiSecret, apiPassphrase, trader)
        ]);
        break;
      case 'bingx':
        [trades, orders] = await Promise.all([
          getBingXTrades(apiKey, apiSecret, trader),
          getBingXOrders(apiKey, apiSecret, trader)
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

    return res.json({ success: true, exchange, trades: paginatedTrades, orders });

  } catch (e) {
    return res.status(500).json({ success: false, error: 'An error occurred while fetching the trade details.' });
  }
});

app.all('/order/:exchange/:symbol/:tradeId', async (req, res) => {
  try {
    const trader = req.get('traderId');
    if (!trader) {
      return res.status(400).json({ success: false, error: 'Trader name is missing' });
    }

    // Fetch userDoc and exchangesData in parallel
    const [userDoc, exchangesData] = await Promise.all([
      db.collection('traders').doc(trader).get(),
      db.collection('traders').doc(trader).get().then(doc => doc.data().exchanges || {})
    ]);

    if (!userDoc.exists) {
      return res.status(404).json({ success: false, error: 'Trader not found' });
    }

    const tradeId = req.params.tradeId;
    const exchange = req.params.exchange;
    const symbol = req.params.symbol;

    if (exchange === "bybit") {
      return res.status(404).json({ success: false, error: 'Bybit is not supported by this endpoint'})
    }

    if (!exchangesData || !(exchange in exchangesData)) {
      return res.status(404).json({ success: false, error: 'No exchange found' });
    }

    const keys = exchangesData[exchange];
    if (!('api_key' in keys && keys.api_key !== 'x')) {
      return res.status(401).json({ success: false, error: 'API key not found for the exchange' });
    }

    const apiKey = keys.api_key;
    const apiSecret = await decryptData(keys.api_secret, trader) || null;

    let apiPassphrase = null;
    if ('api_passphrase' in keys) {
      apiPassphrase = await decryptData(keys.api_passphrase, trader);
    }

    if (exchange === 'kucoin' && !apiPassphrase) {
      return res.status(400).json({ success: false, error: 'Kucoin requires a passphrase' });
    }

    const details = await getTradeProfitLossDetails(trader, tradeId, exchange, symbol, apiKey, apiSecret, apiPassphrase);
    
    if (details) {
      res.json(details);
    } else {
      res.status(404).send(`Trade with ID ${tradeId} not found.`);
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: 'An error occurred while fetching the trade details.' });
  }
});

app.all('/balance/:exchange', async (req, res) => {
    const trader = req.get('traderId');

    if (!trader) {
        return res.status(400).json({ success: false, error: 'Trader ID is missing' });
    }

    const exchange = req.params.exchange;

    if (exchange === "bybit") {
      return res.status(404).json({ success: false, error: 'Bybit is not supported by this endpoint'})
    }

    try {
        const startTime = Date.now();

        const traderRef = db.collection('traders').doc(trader);
        const traderDoc = await traderRef.get();

        if (!traderDoc.exists) {
            return res.status(404).json({ success: false, error: 'Trader not found' });
        }

        const exchangesData = traderDoc.data().exchanges || {};

        if (!exchangesData || !(exchange in exchangesData)) {
            return res.status(404).json({ success: false, error: 'No exchange found' });
        }

        const keys = exchangesData[exchange];
        if (!('api_key' in keys && keys.api_key !== 'x')) {
            return res.status(404).json({ success: false, error: 'API key not found for the exchange' });
        }

        const apiKey = keys.api_key;
        const apiSecret = await decryptData(keys.api_secret, trader) || null;
        
        let apiPassphrase = null;
        if ('api_passphrase' in keys) {
        apiPassphrase = await decryptData(keys.api_passphrase, trader);
        }
        
        if (exchange === 'kucoin' && apiPassphrase === null) {
            return res.status(400).json({ success: false, error: 'Kucoin requires a passphrase' });
        }

        let balance;

        switch (exchange) {
            case 'kucoin':
                balance = await getKucoinBalance(apiKey, apiSecret, apiPassphrase);
                break;
            case 'bingx':
                balance = await getBingXBalance(apiKey, apiSecret);
                break;
            default:
                console.log(`Unknown exchange: ${exchange}`);
                balance = [];
        }

        const endTime = Date.now();
        const executionTime = endTime - startTime;

        return res.status(200).json({ success: true, balance: balance, executionTime });

    } catch (e) {
        return res.status(500).json({ success: false, error: 'An error occurred while fetching the balance details.' });
    }
});

async function mapPositionToTrade(position, trader, symbol, exchange, side) {
  // Fetch the trade id
  const tradeQuerySnapshot = await db
    .collection('traders')
    .doc(trader)
    .collection('trades')
    .where('symbol', '==', symbol)
    .where('exchange', '==', exchange)
    .where('side', '==', side)
    .orderBy('created_at', 'desc')
    .limit(1)
    .get();

  if (tradeQuerySnapshot.empty != false) {
    console.log(`No trade document found for trader ${trader}, symbol ${symbol}, exchange ${exchange}, and side ${side}`);
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
        position.unrealised_pnl_pct = String((parseFloat(position.unrealisedPnlPcnt)*100*parseFloat(position.realLeverage)).toFixed(2));
        position.entryPrice = position.avgEntryPrice;
        position.realised_pnl = position.realisedPnl;
        position.size = position.currentQty;

        return await mapPositionToTrade(position, userId, position.symbol, "kucoin", position.side);
      });

    return await Promise.all(trades);

  } catch (e) {
    console.error(`An error occurred while retrieving trades from KuCoin. Error message: ${e}`);
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
    console.error(`An error occurred while retrieving trades from BingX. Error message: ${e}`);
    return [];
  }
}

async function getTradeProfitLossDetails(trader, tradeId, exchange, symbol, apiKey, apiSecret, apiPassphrase = null) {
  try {
    const tradeDocRef = db.collection('traders').doc(trader).collection('trades').doc(tradeId);

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
      stop_losses: stopLossNewData,
    };
  } catch (error) {
    console.error('Error retrieving trade document:', error);
    return null;
  }
}

async function checkTakeProfitStatus(exchange, symbol, takeProfitData, apiKey, apiSecret, apiPassphrase = null) {
  const promises = takeProfitData.map(async (tp) => {
    if (tp.executed === "0") {
      tp.tp_status = "Queued";
    } else if (tp.executed === "1") {
      let status = await getOrderStatus(exchange, symbol, tp.orderID, apiKey, apiSecret, apiPassphrase);
      tp.tp_status = status;
    } else if (tp.executed === "2") {
      tp.tp_status = "Cancelled";
    }
    return tp;
  });

  return Promise.all(promises);
}


async function checkStopLossStatus(exchange, symbol, stopLossData, apiKey, apiSecret, apiPassphrase = null) {
  const promises = stopLossData.map(async (sl) => {
    if (sl.executed === "0") {
      sl.sl_status = "Queued";
    } else if (sl.executed === "1") {
      let status = await getOrderStatus(exchange, symbol, sl.orderID, apiKey, apiSecret, apiPassphrase);
      sl.sl_status = status;
    } else if (sl.executed === "2") {
      sl.sl_status = "Cancelled";
    }
    return sl;
  });

  return Promise.all(promises);
}

async function getOrderById(exchange, orderID, apiKey, apiSecret, apiPassphrase = null) {
  switch (exchange) {
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
    return order.data;
  }
  catch (e) {
    console.error(`An error occurred while retrieving trades from KuCoin. Error message: ${e}`);
    return null;
  }
}

async function getBingXOrderById(symbol, orderID, apiKey, apiSecret) {
  try {
    const order = await getOrder(apiKey, apiSecret, symbol, orderID);
    return order;
  } catch (e) {
    console.log(`An error occurred while retrieving trades from BingX. Error message: ${e}`);
    return null;
  }
}

async function getKucoinBalance(apiKey, apiSecret, apiPassphrase) {
    try {
        const config = {
            apiKey: apiKey,
            secretKey: apiSecret,
            passphrase: apiPassphrase,
            environment: "live",
        };
        const apiLive = new api();
        apiLive.init(config);

        params = {
            currency: "USDT"
        }
        
        const balance = await apiLive.getAccountOverview(params);
        return String(balance.data.availableBalance);
    }
    catch (e) {
        console.log("Error in getKucoinBalance: ", e);
        return [];
    }
}

async function getBingXBalance(apiKey, apiSecret) {
    try {
        const balance = await getBalance(apiKey, apiSecret);
        return balance.data.data.balance.availableMargin;
    }
    catch (e) {
        console.log("Error in getBingXBalance: ", e);
        return [];
    }
}

async function getKucoinOrders(apiKey, apiSecret, apiPassphrase, trader) {
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
          const tradeDoc = await getTradeDoc(trader, order.symbol, "kucoin", order.side);
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


async function getBingXOrders(apiKey, apiSecret, trader) {
  try {
    const orders = await getOrders(apiKey, apiSecret);

    const bingxMatchingParams = await Promise.all(orders.map(async order => {
      const tradeDoc = await getTradeDoc(trader, order.symbol, "bingx", order.side);
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

async function getTradeDoc(trader, symbol, exchange, side) {
  // Reformat the side variable to have the first letter capital and the rest lowercase
  const formattedSide = side.charAt(0).toUpperCase() + side.slice(1).toLowerCase();

  try {
    const tradeQuerySnapshot = await db
      .collection('traders')
      .doc(trader)
      .collection('trades')
      .where('symbol', '==', symbol)
      .where('exchange', '==', exchange)
      .where('side', '==', formattedSide) // Use the reformatted side in the query
      .orderBy('created_at', 'desc')
      .limit(1)
      .get();

    if (tradeQuerySnapshot.empty) {
      console.log(`No trade document found for trader ${trader}, symbol ${symbol}, exchange ${exchange}, and side ${formattedSide}`);
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