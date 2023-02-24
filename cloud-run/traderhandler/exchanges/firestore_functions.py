from google.cloud import firestore

db = firestore.Client()

# Define collections and field names as constants
COLLECTION_USERS = "users"
COLLECTION_TRADES = "trades"
COLLECTION_PLANS = "plans"
COLLECTION_TAKE_PROFITS = "take-profits"
COLLECTION_STOP_LOSSES = "stop-losses"

FIELD_TRADE_ID = "tradeID"
FIELD_ORDER_ID = "orderID"

FIELD_SYMBOL = "symbol"
FIELD_ORDER_TYPE = "orderType"
FIELD_SIDE = "side"
FIELD_QUANTITY = "quantity"
FIELD_ENTRY = "entry"
FIELD_LEVERAGE = "leverage"
FIELD_MARGIN = "margin"
FIELD_EXCHANGE = "exchange"

FIELD_TP_NUMBER = "tp_number"
FIELD_TP_VALUE = "tp_value"
FIELD_TP_PERCENTAGE = "tp_percentage"

FIELD_SL_NUMBER = "sl_number"
FIELD_SL_VALUE = "sl_value"
FIELD_SL_PERCENTAGE = "sl_percentage"


def store_trade(account_id, order_dict):
    # Store trade data in firestore
    trade_doc_ref = db.collection(COLLECTION_USERS).document(account_id).collection(COLLECTION_TRADES).document(
        order_dict["trade_id"])
    trade_doc_ref.set({
        FIELD_TRADE_ID: order_dict["trade_id"],
        FIELD_ORDER_ID: order_dict["order_id"],
        FIELD_SYMBOL: order_dict["symbol"],
        FIELD_ORDER_TYPE: order_dict["type"],
        FIELD_SIDE: order_dict["side"],
        FIELD_QUANTITY: order_dict["quantity"],
        FIELD_ENTRY: order_dict["entry"],
        FIELD_LEVERAGE: order_dict["leverage"],
        FIELD_MARGIN: order_dict["margin"],
        FIELD_EXCHANGE: order_dict["exchange"]
    })



# Store take profit data in firestore
def store_tp(account_id, tp_dict):
    tp_doc_ref = db.collection(COLLECTION_USERS).document(account_id).collection(COLLECTION_TRADES).document(
        tp_dict["trade_id"]).collection(COLLECTION_TAKE_PROFITS).document(tp_dict["tp_document_id"])
    tp_doc_ref.set({
        FIELD_TP_NUMBER: tp_dict["tp_number"],
        FIELD_TP_VALUE: tp_dict["tp_value"],
        FIELD_TP_PERCENTAGE: tp_dict["tp_percentage"],
        FIELD_ORDER_ID: tp_dict["order_id"],
    })



# Store stop loss data in firestore
def store_sl(account_id, sl_dict):
    tp_doc_ref = db.collection(COLLECTION_USERS).document(account_id).collection(COLLECTION_TRADES).document(
        sl_dict["trade_id"]).collection(COLLECTION_STOP_LOSSES).document(sl_dict["sl_document_id"])
    tp_doc_ref.set({
        FIELD_SL_NUMBER: sl_dict["sl_number"],
        FIELD_SL_VALUE: sl_dict["sl_value"],
        FIELD_SL_PERCENTAGE: sl_dict["sl_percentage"],
        FIELD_ORDER_ID: sl_dict["order_id"],
    })


# Delete single order from firestore
def delete_order(account_id, trade_id):
    db.collection(COLLECTION_USERS).document(account_id).collection(COLLECTION_TRADES).document(trade_id).delete()


# delete single take profit or stop loss from firestore
def delete_tp_sl_order(account_id, trade_id, document_id, is_tp_or_sl):
    if is_tp_or_sl == "tp":
        tp_sl_info = db.collection(COLLECTION_USERS).document(account_id).collection(COLLECTION_TRADES).document(
            trade_id).collection(COLLECTION_TAKE_PROFITS).document(document_id).delete()
    if is_tp_or_sl == "sl":
        tp_sl_info = db.collection(COLLECTION_USERS).document(account_id).collection(COLLECTION_TRADES).document(
            trade_id).collection(COLLECTION_STOP_LOSSES).document(document_id).delete()


# get user keys from firestore with account_id and exchange
def get_user_keys(account_id, exchange):
    keys = db.collection(COLLECTION_USERS).document(account_id)
    exchange_data = keys.get().to_dict()["exchanges"][exchange]
    return exchange_data


# get user margin from firestore with account_id and exchange
def get_user_margin(account_id, plan_id):
    plan = db.collection(COLLECTION_USERS).document(account_id).collection(COLLECTION_PLANS).document(plan_id)
    margin = plan.get().to_dict()["margin"]
    return margin


# get general trade info from firestore with account_id and trade_id
def get_trade_info(account_id, trade_id):
    trade_info = db.collection(COLLECTION_USERS).document(account_id).collection(COLLECTION_TRADES).document(
        trade_id).get().to_dict()
    return trade_info


def get_tp_sl_info(account_id, trade_id, document_id, is_tp_or_sl):
    tp_sl_info = ""
    if is_tp_or_sl == "tp":
        tp_sl_info = db.collection(COLLECTION_USERS).document(account_id).collection(COLLECTION_TRADES).document(
            trade_id).collection(COLLECTION_TAKE_PROFITS).document(document_id).get().to_dict()
    if is_tp_or_sl == "sl":
        tp_sl_info = db.collection(COLLECTION_USERS).document(account_id).collection(COLLECTION_TRADES).document(
            trade_id).collection(COLLECTION_STOP_LOSSES).document(document_id).get().to_dict()
    return tp_sl_info
