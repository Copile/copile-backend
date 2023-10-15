const { Firestore } = require("@google-cloud/firestore");
const fs = require('fs');
const CustomError = require("./error");

// Initialize Firestore
const db = new Firestore();

// Load configuration from config.json file
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

// Destructure configuration variables
const {
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
    FIELD_MARGIN,
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

// Function to fetch the latest trade document for a trader
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

// Function to store trade information
async function store_trade(account_id, order_dict) {
    const trade_doc_ref = db.collection(COLLECTION_TRADERS)
        .doc(account_id)
        .collection(COLLECTION_TRADES)
        .doc(order_dict.trade_id);

    await trade_doc_ref.set({
        [FIELD_TRADE_ID]: String(order_dict.trade_id),
        [FIELD_ORDER_ID]: order_dict.order_id,
        [FIELD_SYMBOL]: order_dict.symbol,
        [FIELD_ORDER_TYPE]: order_dict.type,
        [FIELD_SIDE]: order_dict.side.charAt(0).toUpperCase() + order_dict.side.slice(1),
        [FIELD_QUANTITY]: order_dict.quantity,
        [FIELD_ENTRY]: order_dict.entry,
        [FIELD_LEVERAGE]: order_dict.leverage,
        [FIELD_MARGIN]: order_dict.margin,
        [FIELD_EXCHANGE]: order_dict.exchange,
        [FIELD_CREATED_AT]: Math.floor(Date.now() / 1000),
    });
}

// Function to store take profit information
async function store_tp(account_id, tp_dict) {
    const tp_doc_ref = db.collection(COLLECTION_TRADERS)
        .doc(account_id)
        .collection(COLLECTION_TRADES)
        .doc(tp_dict.trade_id)
        .collection(COLLECTION_TAKE_PROFITS)
        .doc(tp_dict.tp_document_id);

    await tp_doc_ref.set({
        [FIELD_ORDER_ID]: String(tp_dict.order_id),
        [FIELD_EXECUTED]: "1",
        [FIELD_TP_NUMBER]: tp_dict.tp_number,
        [FIELD_TP_VALUE]: tp_dict.tp_value,
        [FIELD_TP_PERCENTAGE]: tp_dict.tp_percentage,
        [FIELD_TP_AMOUNT]: tp_dict.tp_amount,
    });
}

// Function to store stop loss information
async function store_sl(account_id, sl_dict) {
    const sl_doc_ref = db.collection(COLLECTION_TRADERS)
        .doc(account_id)
        .collection(COLLECTION_TRADES)
        .doc(sl_dict.trade_id)
        .collection(COLLECTION_STOP_LOSSES)
        .doc(sl_dict.sl_document_id);

    await sl_doc_ref.set({
        [FIELD_ORDER_ID]: String(sl_dict.order_id),
        [FIELD_EXECUTED]: "1",
        [FIELD_SL_PERCENTAGE]: sl_dict.sl_percentage,
        [FIELD_SL_NUMBER]: sl_dict.sl_number,
        [FIELD_SL_VALUE]: sl_dict.sl_value,
        [FIELD_SL_AMOUNT]: sl_dict.sl_amount,
    });
}

// Function to delete a trade document
async function delete_order(account_id, trade_id) {
    const trade_doc_ref = db.collection(COLLECTION_TRADERS)
        .doc(account_id)
        .collection(COLLECTION_TRADES)
        .doc(trade_id);

    await trade_doc_ref.delete();
}

// Function to delete a take profit or stop loss order
const deleteTpSlOrder = async (accountId, tradeId, documentId, isTpOrSl) => {
    const tradeRef = db.collection(COLLECTION_TRADERS)
        .doc(accountId)
        .collection(COLLECTION_TRADES)
        .doc(tradeId);

    if (isTpOrSl === 'tp') {
        await tradeRef.collection(COLLECTION_TAKE_PROFITS).doc(documentId).delete();
    } else if (isTpOrSl === 'sl') {
        await tradeRef.collection(COLLECTION_STOP_LOSSES).doc(documentId).delete();
    }
};

// Function to get trade information
const getTradeInfo = async (accountId, tradeId) => {
    const tradeRef = db.collection(COLLECTION_TRADERS)
        .doc(accountId)
        .collection(COLLECTION_TRADES)
        .doc(tradeId);

    const tradeInfo = (await tradeRef.get()).data();
    return tradeInfo;
};

// Function to get take profit or stop loss information
const getTpSlInfo = async (accountId, tradeId, documentId, isTpOrSl) => {
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
};

// Function to get all take profit and stop loss orders for a trade
const getTpSlOrders = async (accountId, tradeId) => {
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
};

module.exports = {
    fetchLatestTradeDoc,
    store_trade,
    store_tp,
    store_sl,
    delete_order,
    deleteTpSlOrder,
    getTradeInfo,
    getTpSlInfo,
    getTpSlOrders
};
