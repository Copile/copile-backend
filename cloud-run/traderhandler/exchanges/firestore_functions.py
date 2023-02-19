from google.cloud import firestore

db = firestore.Client()

# Define collections and field names as constants
COLLECTION_USERS = "users"
COLLECTION_TRADES = "trades"
COLLECTION_ORDERS = "orders"
FIELD_SYMBOL = "symbol"
FIELD_SIDE = "side"
FIELD_ORDER_TYPE = "orderType"
FIELD_QUANTITY = "quantity"
FIELD_ENTRY = "entry"
FIELD_EXCHANGE = "exchange"
FIELD_TRADE_ID = "tradeID"
FIELD_TP = "tp"
FIELD_TP_PERCENTAGE = "tp_percentage"
FIELD_SL = "sl"
FIELD_SL_PERCENTAGE = "sl_percentage"
FIELD_START_ORDER = "start-order"
FIELD_TAKE_PROFITS = "take-profits"
FIELD_STOP_LOSSES = "stop-losses"


# Store trade data in firestore
def store_trade(account_id, order_dict):
    transaction = db.transaction()

    @firestore.transactional
    def transactional_update(t_account_id, t_order_dict):
        trade_doc_ref = db.collection(COLLECTION_USERS).document(t_account_id).collection(COLLECTION_TRADES).document(
            t_order_dict[FIELD_TRADE_ID])
        trade_doc_ref.set({
            FIELD_SYMBOL: t_order_dict[FIELD_SYMBOL],
            FIELD_SIDE: t_order_dict[FIELD_SIDE],
            FIELD_ORDER_TYPE: t_order_dict[FIELD_ORDER_TYPE],
            FIELD_QUANTITY: t_order_dict[FIELD_QUANTITY],
            FIELD_ENTRY: t_order_dict[FIELD_ENTRY],
            FIELD_EXCHANGE: t_order_dict[FIELD_EXCHANGE],
            FIELD_TRADE_ID:  t_order_dict[FIELD_TRADE_ID],
        })

        order_doc_ref = db.collection(COLLECTION_USERS).document(t_account_id).collection(COLLECTION_ORDERS).document(
            t_order_dict[FIELD_TRADE_ID])
        order_doc_ref.set({
            FIELD_START_ORDER: t_order_dict,
            FIELD_TRADE_ID: t_order_dict[FIELD_TRADE_ID]
        })

    transactional_update(account_id, order_dict)


# Store take profit data in firestore
def store_tp(account_id, tp_dict):
    transaction = db.transaction()

    @firestore.transactional
    def transactional_update(t_account_id, t_tp_dict):
        trade_doc_ref = db.collection(COLLECTION_USERS).document(t_account_id).collection(COLLECTION_TRADES).document(
            t_tp_dict[FIELD_TRADE_ID])
        trade_doc_ref.update({
            FIELD_TP: t_tp_dict[FIELD_TP],
            FIELD_TP_PERCENTAGE: t_tp_dict[FIELD_TP_PERCENTAGE]
        })

        order_doc_ref = db.collection(COLLECTION_USERS).document(t_account_id).collection(COLLECTION_ORDERS).document(
            t_tp_dict[FIELD_TRADE_ID])
        order_doc_ref.set({
            FIELD_TAKE_PROFITS: firestore.ArrayUnion([t_tp_dict])
        })

    transactional_update(account_id, tp_dict)


# Store stop loss data in firestore
def store_sl(account_id, sl_dict):
    transaction = db.transaction()

    @firestore.transactional
    def transactional_update(t_account_id, t_sl_dict):
        trade_doc_ref = db.collection(COLLECTION_USERS).document(t_account_id).collection(COLLECTION_TRADES).document(
            t_sl_dict[FIELD_TRADE_ID])
        trade_doc_ref.update({
            FIELD_SL: t_sl_dict[FIELD_SL],
            FIELD_SL_PERCENTAGE: t_sl_dict[FIELD_SL_PERCENTAGE]
        })

        order_doc_ref = db.collection(COLLECTION_USERS).document(t_account_id).collection(COLLECTION_ORDERS).document(
            t_sl_dict[FIELD_TRADE_ID])
        order_doc_ref.set({
            FIELD_STOP_LOSSES: firestore.ArrayUnion([t_sl_dict])
        })

    transactional_update(account_id, sl_dict)


# Delete single order from firestore
def delete_order(account_id, trade_id):
    db.collection(COLLECTION_USERS).document(account_id).collection(COLLECTION_TRADES).document(trade_id).delete()


# Delete all orders from firestore
def delete_all_orders(account_id):
    trades = db.collection(COLLECTION_USERS).document(account_id).collection(COLLECTION_TRADES).stream()

    for trade in trades:
        trade_id = trade.id
        delete_order(account_id, trade_id)
