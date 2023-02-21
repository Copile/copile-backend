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

FIELD_TP_NUMBER = "tp-number"
FIELD_TP_VALUE = "tp-value"
FIELD_TP_PERCENTAGE = "tp-percentage"

FIELD_SL_NUMBER = "sl-number"
FIELD_SL_VALUE = "sl-value"
FIELD_SL_PERCENTAGE = "sl-percentage"


def store_trade(account_id, order_dict):
    # Store trade data in firestore
    transaction = db.transaction()

    @firestore.transactional
    def transactional_update(t_account_id, t_order_dict):
        trade_doc_ref = db.collection(COLLECTION_USERS).document(t_account_id).collection(COLLECTION_TRADES).document(
            t_order_dict["trade_id"])
        trade_doc_ref.set({
            FIELD_TRADE_ID: t_order_dict["trade_id"],
            FIELD_ORDER_ID: t_order_dict["order_id"],

            FIELD_SYMBOL: t_order_dict["symbol"],
            FIELD_ORDER_TYPE: t_order_dict["type"],
            FIELD_SIDE: t_order_dict["side"],
            FIELD_QUANTITY: t_order_dict["quantity"],
            FIELD_ENTRY: t_order_dict["entry"],
            FIELD_LEVERAGE: t_order_dict["leverage"],
            FIELD_MARGIN: t_order_dict["margin"],
            FIELD_EXCHANGE: t_order_dict["exchange"]
        })

    transactional_update(account_id, order_dict)


# Store take profit data in firestore
def store_tp(account_id, tp_dict):
    transaction = db.transaction()

    @firestore.transactional
    def transactional_update(t_account_id, t_tp_dict):
        tp_doc_ref = db.collection(COLLECTION_USERS).document(t_account_id).collection(COLLECTION_TRADES).document(
            t_tp_dict[FIELD_TRADE_ID]).collection(COLLECTION_TAKE_PROFITS).document(t_tp_dict["tp_document_id"])
        tp_doc_ref.update({
            FIELD_TP_NUMBER: t_tp_dict["tp_number"],
            FIELD_TP_VALUE: t_tp_dict["tp_value"],
            FIELD_TP_PERCENTAGE: t_tp_dict["tp_percentage"]
        })

    transactional_update(account_id, tp_dict)


# Store stop loss data in firestore
def store_sl(account_id, sl_dict):
    transaction = db.transaction()

    @firestore.transactional
    def transactional_update(t_account_id, t_sl_dict):
        tp_doc_ref = db.collection(COLLECTION_USERS).document(t_account_id).collection(COLLECTION_TRADES).document(
            t_sl_dict[FIELD_TRADE_ID]).collection(COLLECTION_TAKE_PROFITS).document(t_sl_dict["sl_document_id"])
        tp_doc_ref.update({
            FIELD_TP_NUMBER: t_sl_dict["sl_number"],
            FIELD_TP_VALUE: t_sl_dict["sl_value"],
            FIELD_TP_PERCENTAGE: t_sl_dict["sl_percentage"]
        })

    transactional_update(account_id, sl_dict)


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
