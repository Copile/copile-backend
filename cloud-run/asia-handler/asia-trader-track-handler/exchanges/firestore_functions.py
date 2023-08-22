from google.cloud import firestore
from .decryption import decryptData
import time
import asyncio

db = firestore.Client()

# Define collections and field names as constants
COLLECTION_TRADERS = "traders"
COLLECTION_TRADES = "trades"
COLLECTION_PLANS = "plans"
COLLECTION_TAKE_PROFITS = "take-profits"
COLLECTION_STOP_LOSSES = "stop-losses"

FIELD_TRADE_ID = "tradeID"
FIELD_ORDER_ID = "orderID"
FIELD_EXECUTED = "executed"

FIELD_SYMBOL = "symbol"
FIELD_ORDER_TYPE = "orderType"
FIELD_SIDE = "side"
FIELD_QUANTITY = "quantity"
FIELD_ENTRY = "entry"
FIELD_LEVERAGE = "leverage"
FIELD_MARGIN = "margin"
FIELD_EXCHANGE = "exchange"
FIELD_CREATED_AT= "created_at"

FIELD_TP_NUMBER = "tp_number"
FIELD_TP_VALUE = "tp_value"
FIELD_TP_PERCENTAGE = "tp_percentage"
FIELD_TP_AMOUNT = "tp_amount"

FIELD_SL_NUMBER = "sl_number"
FIELD_SL_VALUE = "sl_value"
FIELD_SL_PERCENTAGE = "sl_percentage"
FIELD_SL_AMOUNT = "sl_amount"


async def store_trade(account_id, order_dict):
    # Store trade data in firestore
    trade_doc_ref = db.collection(COLLECTION_TRADERS).document(account_id).collection(COLLECTION_TRADES).document(
        order_dict["trade_id"])
    trade_doc_ref.set({
        FIELD_TRADE_ID: str(order_dict["trade_id"]),
        FIELD_ORDER_ID: order_dict["order_id"],
        FIELD_SYMBOL: order_dict["symbol"],
        FIELD_ORDER_TYPE: order_dict["type"],
        FIELD_SIDE: order_dict["side"].capitalize(),
        FIELD_QUANTITY: order_dict["quantity"],
        FIELD_ENTRY: order_dict["entry"],
        FIELD_LEVERAGE: order_dict["leverage"],
        FIELD_MARGIN: order_dict["margin"],
        FIELD_EXCHANGE: order_dict["exchange"],
        FIELD_CREATED_AT: int(time.time())
    })



# Store take profit data in firestore
async def store_tp(account_id, tp_dict):
    tp_doc_ref = db.collection(COLLECTION_TRADERS).document(account_id).collection(COLLECTION_TRADES).document(
        tp_dict["trade_id"]).collection(COLLECTION_TAKE_PROFITS).document(tp_dict["tp_document_id"])
    tp_doc_ref.set({
        FIELD_TP_NUMBER: tp_dict["tp_number"],
        FIELD_TP_VALUE: tp_dict["tp_value"],
        FIELD_TP_PERCENTAGE: tp_dict["tp_percentage"],
        FIELD_TP_AMOUNT: tp_dict["tp_amount"],
        FIELD_EXECUTED: "0"
    })

# Store take profit data in firestore
async def store_tp_exec(account_id, tp_dict):
    tp_doc_ref = db.collection(COLLECTION_TRADERS).document(account_id).collection(COLLECTION_TRADES).document(
        tp_dict["trade_id"]).collection(COLLECTION_TAKE_PROFITS).document(tp_dict["tp_document_id"])
    tp_doc_ref.set({
        FIELD_ORDER_ID: str(tp_dict["order_id"]),
        FIELD_EXECUTED: "1",
        FIELD_TP_NUMBER: tp_dict["tp_number"],
        FIELD_TP_VALUE: tp_dict["tp_value"],
        FIELD_TP_PERCENTAGE: tp_dict["tp_percentage"],
        FIELD_TP_AMOUNT: tp_dict["tp_amount"]
    })


# Store stop loss data in firestore
async def store_sl(account_id, sl_dict):
    tp_doc_ref = db.collection(COLLECTION_TRADERS).document(account_id).collection(COLLECTION_TRADES).document(
        sl_dict["trade_id"]).collection(COLLECTION_STOP_LOSSES).document(sl_dict["sl_document_id"])
    tp_doc_ref.set({
        FIELD_SL_NUMBER: sl_dict["sl_number"],
        FIELD_SL_VALUE: sl_dict["sl_value"],
        FIELD_SL_PERCENTAGE: sl_dict["sl_percentage"],
        FIELD_EXECUTED: "0"
    })

# Store stop loss data in firestore
async def store_sl_exec(account_id, sl_dict):
    tp_doc_ref = db.collection(COLLECTION_TRADERS).document(account_id).collection(COLLECTION_TRADES).document(
        sl_dict["trade_id"]).collection(COLLECTION_STOP_LOSSES).document(sl_dict["sl_document_id"])
    tp_doc_ref.set({
        FIELD_ORDER_ID: str(sl_dict["order_id"]),
        FIELD_EXECUTED: "1",
        FIELD_SL_PERCENTAGE: sl_dict["sl_percentage"],
        FIELD_SL_NUMBER: sl_dict["sl_number"],
        FIELD_SL_VALUE: sl_dict["sl_value"],
        FIELD_SL_AMOUNT: sl_dict['sl_amount']
    })

# Delete single order from firestore
async def delete_order(account_id, trade_id):
    db.collection(COLLECTION_TRADERS).document(account_id).collection(COLLECTION_TRADES).document(trade_id).delete()


# delete single take profit or stop loss from firestore
async def delete_tp_sl_order(account_id, trade_id, document_id, is_tp_or_sl):
    if is_tp_or_sl == "tp":
        tp_sl_info = db.collection(COLLECTION_TRADERS).document(account_id).collection(COLLECTION_TRADES).document(
            trade_id).collection(COLLECTION_TAKE_PROFITS).document(document_id).delete()
    if is_tp_or_sl == "sl":
        tp_sl_info = db.collection(COLLECTION_TRADERS).document(account_id).collection(COLLECTION_TRADES).document(
            trade_id).collection(COLLECTION_STOP_LOSSES).document(document_id).delete()

# get user keys from firestore with account_id and exchange
async def get_user_keys(account_id, exchange):
    keys = db.collection(COLLECTION_TRADERS).document(account_id)
    exchange_data = keys.get().to_dict()["exchanges"][exchange]
    exchange_data['api_secret'] = await decryptData(account_id, exchange_data['api_secret'])
    
    # Decrypt the api_passphrase if encrypted
    if 'api_passphrase' in exchange_data:
        exchange_data['api_passphrase'] = await decryptData(account_id, exchange_data['api_passphrase'])

    return exchange_data

# get user margin from firestore with account_id and exchange
async def get_user_margin(account_id, plan_id):
    plan = db.collection(COLLECTION_TRADERS).document(account_id).collection(COLLECTION_PLANS).document(plan_id)
    margin = plan.get().to_dict()["margin"]
    return margin


# get general trade info from firestore with account_id and trade_id
async def get_trade_info(account_id, trade_id):
    trade_info = db.collection(COLLECTION_TRADERS).document(account_id).collection(COLLECTION_TRADES).document(
        trade_id).get().to_dict()
    return trade_info


async def get_tp_sl_info(account_id, trade_id, document_id, is_tp_or_sl):
    tp_sl_info = ""
    if is_tp_or_sl == "tp":
        tp_sl_info = db.collection(COLLECTION_TRADERS).document(account_id).collection(COLLECTION_TRADES).document(
            trade_id).collection(COLLECTION_TAKE_PROFITS).document(document_id).get().to_dict()
    if is_tp_or_sl == "sl":
        tp_sl_info = db.collection(COLLECTION_TRADERS).document(account_id).collection(COLLECTION_TRADES).document(
            trade_id).collection(COLLECTION_STOP_LOSSES).document(document_id).get().to_dict()
    return tp_sl_info

async def check_executed_status(account_id, trade_id, document_id, is_tp_or_sl):
    if is_tp_or_sl == "tp":
        executed_info = db.collection(COLLECTION_TRADERS).document(account_id).collection(COLLECTION_TRADES).document(
            trade_id).collection(COLLECTION_TAKE_PROFITS).document(document_id).get().to_dict()["executed"]
    if is_tp_or_sl == "sl":
        executed_info = db.collection(COLLECTION_TRADERS).document(account_id).collection(COLLECTION_TRADES).document(
            trade_id).collection(COLLECTION_STOP_LOSSES).document(document_id).get().to_dict()["executed"]
    return executed_info

async def change_executed_status_tp_sl(account_id, trade_id, document_id, is_tp_or_sl):
    if is_tp_or_sl == "tp":
        tp_doc_ref = db.collection(COLLECTION_TRADERS).document(account_id).collection(COLLECTION_TRADES).document(
            trade_id).collection(COLLECTION_TAKE_PROFITS).document(document_id)
        tp_doc_ref.update({FIELD_EXECUTED: "2"})
    if is_tp_or_sl == "sl":
        sl_doc_ref = db.collection(COLLECTION_TRADERS).document(account_id).collection(COLLECTION_TRADES).document(
            trade_id).collection(COLLECTION_STOP_LOSSES).document(document_id)
        sl_doc_ref.update({
            FIELD_EXECUTED: "2"
        })

async def get_tp_sl_orders(account_id, trade_id):
    tp_sl_orders = []

    tp_collection = db.collection(COLLECTION_TRADERS).document(account_id).collection(COLLECTION_TRADES).document(
        trade_id).collection(COLLECTION_TAKE_PROFITS).get()
    for tp_doc in tp_collection:
        tp_data = tp_doc.to_dict()
        tp_data['document_id'] = tp_doc.id  # Add document ID to the dictionary
        tp_sl_orders.append(tp_data)

    sl_collection = db.collection(COLLECTION_TRADERS).document(account_id).collection(COLLECTION_TRADES).document(
        trade_id).collection(COLLECTION_STOP_LOSSES).get()
    for sl_doc in sl_collection:
        sl_data = sl_doc.to_dict()
        sl_data['document_id'] = sl_doc.id  # Add document ID to the dictionary
        tp_sl_orders.append(sl_data)

    return tp_sl_orders

async def check_document_exists(account_id, trade_id, document_id, is_tp_or_sl):
    if is_tp_or_sl == "tp":
        tp_sl_info = db.collection(COLLECTION_TRADERS).document(account_id).collection(COLLECTION_TRADES).document(
            trade_id).collection(COLLECTION_TAKE_PROFITS).document(document_id).get()
    if is_tp_or_sl == "sl":
        tp_sl_info = db.collection(COLLECTION_TRADERS).document(account_id).collection(COLLECTION_TRADES).document(
            trade_id).collection(COLLECTION_STOP_LOSSES).document(document_id).get()
    return tp_sl_info