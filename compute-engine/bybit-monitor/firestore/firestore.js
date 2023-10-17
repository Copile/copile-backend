//const { Firestore } = require("@google-cloud/firestore");
const fs = require('fs');
const CustomError = require("./error");
const { v4: uuidv4 } = require('uuid');

var admin = require("firebase-admin");

var serviceAccount = require("./serviceAccount.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Initialize Firestore
const db = admin.firestore();

// Load configuration from config.json file
const config = require("./config.json");

// Destructure configuration variables
const {
    COLLECTION_TRADERS,
    COLLECTION_TRADES,
    COLLECTION_TAKE_PROFITS,
    COLLECTION_STOP_LOSSES,
    FIELD_TRADE_ID,
    FIELD_ORDER_ID,
    FIELD_EXECUTED,
    FIELD_SYMBOL,
    FIELD_ORDER_TYPE,
    FIELD_SIDE,
    FIELD_QUANTITY,
    FIELD_ENTRY,
    FIELD_LEVERAGE,
    FIELD_EXCHANGE,
    FIELD_CREATED_AT,
    FIELD_TP_NUMBER,
    FIELD_TP_VALUE,
    FIELD_TP_PERCENTAGE,
    FIELD_TP_AMOUNT,
    FIELD_SL_NUMBER,
    FIELD_SL_VALUE,
    FIELD_SL_PERCENTAGE,
    FIELD_SL_AMOUNT
} = config;

// Function to fetch the latest trade document ID for a trader
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

        const latestTradeDocId = tradeQuerySnapshot.docs[0].id;

        return latestTradeDocId;
    } catch (error) {
        throw new CustomError({
            message: `Error fetching trade document ID: ${error.message}`,
            status: 500,
            source: "fetchLatestTradeDocId",
        });
    }
}

// Function to store trade information
async function storeTrade(accountId, orderDict) {
    try {
        let tradeId = String(uuidv4());

        const trade_doc_ref = db.collection(COLLECTION_TRADERS)
            .doc(accountId)
            .collection(COLLECTION_TRADES)
            .doc(tradeId);

        await trade_doc_ref.set({
            [FIELD_TRADE_ID]: tradeId,
            [FIELD_ORDER_ID]: orderDict.orderId,
            [FIELD_SYMBOL]: orderDict.symbol,
            [FIELD_ORDER_TYPE]: orderDict.type,
            [FIELD_SIDE]: orderDict.side.charAt(0).toUpperCase() + orderDict.side.slice(1),
            [FIELD_QUANTITY]: orderDict.quantity,
            [FIELD_ENTRY]: orderDict.entry,
            [FIELD_LEVERAGE]: orderDict.leverage,
            [FIELD_EXCHANGE]: "bybit",
            [FIELD_CREATED_AT]: Math.floor(Date.now() / 1000),
        });
    } catch (error) {
        throw new CustomError({
            message: `Error storing new trade: ${error.message}`,
            status: 500,
            source: "storeTrade",
        });
    }
}

// Function to store take profit information
async function storeTP(accountId, tpDict) {
    try {
        const tp_doc_ref = db.collection(COLLECTION_TRADERS)
            .doc(accountId)
            .collection(COLLECTION_TRADES)
            .doc(tpDict.tradeId)
            .collection(COLLECTION_TAKE_PROFITS)
            .doc(tpDict.tpDocumentId);

        await tp_doc_ref.set({
            [FIELD_ORDER_ID]: String(tpDict.orderId),
            [FIELD_EXECUTED]: "1",
            [FIELD_TP_NUMBER]: tpDict.tpNumber,
            [FIELD_TP_VALUE]: tpDict.tpValue,
            [FIELD_TP_PERCENTAGE]: tpDict.tpPercentage,
            [FIELD_TP_AMOUNT]: tpDict.tpAmount,
        });
    } catch (error) {
        throw new CustomError({
            message: `Error storing new take-profit: ${error.message}`,
            status: 500,
            source: "storeTP",
        });
    }
}

// Function to store stop loss information
async function storeSL(accountId, slDict) {
    try {
        const sl_doc_ref = db.collection(COLLECTION_TRADERS)
            .doc(accountId)
            .collection(COLLECTION_TRADES)
            .doc(slDict.tradeId)
            .collection(COLLECTION_STOP_LOSSES)
            .doc(slDict.slDocumentId);

        await sl_doc_ref.set({
            [FIELD_ORDER_ID]: String(slDict.orderId),
            [FIELD_EXECUTED]: "1",
            [FIELD_SL_PERCENTAGE]: slDict.slPercentage,
            [FIELD_SL_NUMBER]: slDict.slNumber,
            [FIELD_SL_VALUE]: slDict.slValue,
            [FIELD_SL_AMOUNT]: slDict.slAmount,
        });
    } catch (error) {
        throw new CustomError({
            message: `Error storing new stop-loss: ${error.message}`,
            status: 500,
            source: "storeSL",
        });
    }
}

// Function to delete a trade document
async function deleteOrder(accountId, tradeId) {
    try {
        const trade_doc_ref = db.collection(COLLECTION_TRADERS)
            .doc(accountId)
            .collection(COLLECTION_TRADES)
            .doc(tradeId);

        await trade_doc_ref.delete();
    } catch (error) {
        throw new CustomError({
            message: `Error deleting order: ${error.message}`,
            status: 500,
            source: "deleteOrder",
        });
    }
}

// Function to delete a take profit or stop loss order
const deleteTpSlOrder = async (accountId, tradeId, documentId, isTpOrSl) => {
    try {
        const tradeRef = db.collection(COLLECTION_TRADERS)
            .doc(accountId)
            .collection(COLLECTION_TRADES)
            .doc(tradeId);

        if (isTpOrSl === 'tp') {
            await tradeRef.collection(COLLECTION_TAKE_PROFITS).doc(documentId).delete();
        } else if (isTpOrSl === 'sl') {
            await tradeRef.collection(COLLECTION_STOP_LOSSES).doc(documentId).delete();
        }
    } catch (error) {
        throw new CustomError({
            message: `Error deleting tp/sl order: ${error.message}`,
            status: 500,
            source: "deleteTpSlOrder",
        });
    }
};

// Function to get trade information
const getTradeInfo = async (accountId, tradeId) => {
    try {
        const tradeRef = db.collection(COLLECTION_TRADERS)
            .doc(accountId)
            .collection(COLLECTION_TRADES)
            .doc(tradeId);

        const tradeInfo = (await tradeRef.get()).data();
        return tradeInfo;
    } catch (error) {
        throw new CustomError({
            message: `Error getting trade info: ${error.message}`,
            status: 500,
            source: "getTradeInfo",
        });
    }
};

// Function to update the trade quantity
const updateTradeQuantity = async (accountId, tradeId, newQuantity) => {
    try {
        const tradeRef = db.collection(COLLECTION_TRADERS)
            .doc(accountId)
            .collection(COLLECTION_TRADES)
            .doc(tradeId);

        await tradeRef.update({ 'quantity': newQuantity });
        return `Trade quantity successfully updated to ${newQuantity}`;
    } catch (error) {
        throw new CustomError({
            message: `Error updating trade quantity: ${error.message}`,
            status: 500,
            source: "updateTradeQuantity",
        });
    }
};

// Function to get take profit or stop loss information
const getTpSlInfo = async (accountId, tradeId, documentId, isTpOrSl) => {
    try {
        const tradeRef = db.collection(COLLECTION_TRADERS)
            .doc(accountId)
            .collection(COLLECTION_TRADES)
            .doc(tradeId);

        let tpSlInfo;
        if (isTpOrSl === 'tp') {
            tpSlInfo = (await tradeRef.collection(COLLECTION_TAKE_PROFITS).doc(documentId).get()).data();
        } else if (isTpOrSl === 'sl') {
            tpSlInfo = (await tradeRef.collection(COLLECTION_STOP_LOSSES).doc(documentId).get()).data();
        }
        return tpSlInfo;
    } catch (error) {
        throw new CustomError({
            message: `Error getting tp/sl info: ${error.message}`,
            status: 500,
            source: "getTpSlInfo",
        });
    }
};

// New function to get a TP or SL order by orderID
const getSpecficOrder = async (accountId, tradeId, orderID, isTpOrSl) => {
    try {
        const tradeRef = db.collection(COLLECTION_TRADERS)
            .doc(accountId)
            .collection(COLLECTION_TRADES)
            .doc(tradeId);

        let collectionName = isTpOrSl === 'tp' ? COLLECTION_TAKE_PROFITS : COLLECTION_STOP_LOSSES;

        const orderCollection = await tradeRef.collection(collectionName)
            .where("orderID", "==", orderID)
            .get();

        let orderData = null;

        orderCollection.forEach(doc => {
            if (doc.exists) {
                orderData = doc.data();
                orderData.documentId = doc.id;
                orderData.tradeType = isTpOrSl;
            }
        });

        if (orderData) {
            return orderData;
        } else {
            throw new CustomError({
                message: `Order with ID ${orderID} not found`,
                status: 404,
                source: "getTpOrSlOrderByOrderId",
            });
        }

    } catch (error) {
        throw new CustomError({
            message: `Error getting tp/sl order by orderID: ${error.message}`,
            status: 500,
            source: "getTpOrSlOrderByOrderId",
        });
    }
};

// Function to get all take profit and stop loss orders for a trade
const getTpSlOrders = async (accountId, tradeId) => {
    try {
        const tradeRef = db.collection(COLLECTION_TRADERS)
            .doc(accountId)
            .collection(COLLECTION_TRADES)
            .doc(tradeId);

        const [tpCollection, slCollection] = await Promise.all([
            tradeRef.collection(COLLECTION_TAKE_PROFITS).get(),
            tradeRef.collection(COLLECTION_STOP_LOSSES).get()
        ]);

        let tpSlOrders = [];

        tpCollection.forEach(doc => {
            let tpData = doc.data();
            tpData.documentId = doc.id;
            tpData.tradeType = 'tp';
            tpSlOrders.push(tpData);
        });

        slCollection.forEach(doc => {
            let slData = doc.data();
            slData.documentId = doc.id;
            slData.tradeType = 'sl';
            tpSlOrders.push(slData);
        });

        return tpSlOrders;
    } catch (error) {
        throw new CustomError({
            message: `Error getting tp/sl orders: ${error.message}`,
            status: 500,
            source: "getTpSlOrders",
        });
    }
};

module.exports = {
    fetchLatestTradeDoc,
    storeTrade,
    updateTradeQuantity,
    getSpecficOrder,
    storeTP,
    storeSL,
    deleteOrder,
    deleteTpSlOrder,
    getTradeInfo,
    getTpSlInfo,
    getTpSlOrders
};
