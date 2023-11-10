const { Firestore } = require("@google-cloud/firestore");
const CustomError = require("./error");

const db = new Firestore();

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

// Function to get the trader api keys
async function getUserKeys(accountId, exchange) {
    // Get user keys from Firestore with accountId and exchange
    const documentRef = firestore.collection('traders').doc(accountId);
    const documentSnapshot = await documentRef.get();
    const userData = documentSnapshot.data();
    
    if (!userData || !userData.exchanges || !userData.exchanges[exchange]) {
      throw new Error('User data not found');
    }
  
    const exchangeData = userData.exchanges[exchange];
    exchangeData.api_secret = await decryptData(accountId, exchangeData.api_secret);
  
    // Decrypt the api_passphrase if encrypted
    if (exchangeData.api_passphrase) {
      exchangeData.api_passphrase = await decryptData(accountId, exchangeData.api_passphrase);
    }
  
    return exchangeData;
}

// Function to store trade information
async function storeTrade(accountId, orderDict) {
    try {

        const trade_doc_ref = db.collection(COLLECTION_TRADERS)
            .doc(accountId)
            .collection(COLLECTION_TRADES)
            .doc(orderDict.tradeId);

        await trade_doc_ref.set({
            [FIELD_TRADE_ID]: orderDict.tradeId,
            [FIELD_ORDER_ID]: orderDict.orderId,
            [FIELD_SYMBOL]: orderDict.symbol,
            [FIELD_ORDER_TYPE]: orderDict.type,
            [FIELD_SIDE]: orderDict.side.charAt(0).toUpperCase() + orderDict.side.slice(1),
            [FIELD_QUANTITY]: orderDict.quantity,
            [FIELD_ENTRY]: orderDict.entry,
            [FIELD_LEVERAGE]: orderDict.leverage,
            [FIELD_EXCHANGE]: orderDict.exchange,
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
            .doc(tpDict.tp_id);

        await tp_doc_ref.set({
            [FIELD_ORDER_ID]: String(tpDict.orderId),
            [FIELD_EXECUTED]: "1",
            [FIELD_TP_NUMBER]: tpDict.tp_number,
            [FIELD_TP_VALUE]: tpDict.tp_value,
            [FIELD_TP_PERCENTAGE]: tpDict.tp_percentage,
            [FIELD_TP_AMOUNT]: tpDict.tp_amount,
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
            .doc(slDict.sl_id);

        await sl_doc_ref.set({
            [FIELD_ORDER_ID]: String(slDict.orderId),
            [FIELD_EXECUTED]: "1",
            [FIELD_SL_PERCENTAGE]: slDict.sl_percentage,
            [FIELD_SL_NUMBER]: slDict.sl_number,
            [FIELD_SL_VALUE]: slDict.sl_value,
            [FIELD_SL_AMOUNT]: slDict.sl_amount,
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

// New function to get a TP or SL order by documentId
const getSpecificOrder = async (accountId, tradeId, documentId, isTpOrSl) => {
    try {
        const tradeRef = db.collection(COLLECTION_TRADERS)
            .doc(accountId)
            .collection(COLLECTION_TRADES)
            .doc(tradeId);

        let collectionName = isTpOrSl === 'tp' ? COLLECTION_TAKE_PROFITS : COLLECTION_STOP_LOSSES;

        const orderDoc = await tradeRef.collection(collectionName)
            .doc(documentId)
            .get();

        let orderData = null;

        if (orderDoc.exists) {
            orderData = orderDoc.data();
            orderData.documentId = orderDoc.id;
            orderData.tradeType = isTpOrSl;
        }

        return orderData ? orderData : null;

    } catch (error) {
        throw new CustomError({
            message: `Error getting tp/sl order by documentId: ${error.message}`,
            status: 500,
            source: "getTpOrSlOrderByDocumentId",
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

// Function to get all take profit orders for a trade
const getTpOrders = async (accountId, tradeId) => {
    try {
        const tradeRef = db.collection(COLLECTION_TRADERS)
            .doc(accountId)
            .collection(COLLECTION_TRADES)
            .doc(tradeId);

        tpCollection = await tradeRef.collection(COLLECTION_TAKE_PROFITS).get();

        let tpOrders = [];

        tpCollection.forEach(doc => {
            let tpData = doc.data();
            tpData.documentId = doc.id;
            tpData.tradeType = 'tp';
            tpOrders.push(tpData);
        });

        return tpOrders;
    } catch (error) {
        throw new CustomError({
            message: `Error getting tp orders: ${error.message}`,
            status: 500,
            source: "getTpOrders",
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
    storeTrade,
    storeTP,
    storeSL,
    deleteOrder,
    deleteTpSlOrder,
    getTradeInfo,
    getTpSlOrders,
    getTpOrders,
    updateTradeQuantity,
    getSpecificOrder,
    getUserKeys,
};