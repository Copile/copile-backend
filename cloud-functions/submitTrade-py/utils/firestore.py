#from google.cloud import firestore
import firebase_admin
from firebase_admin import credentials, firestore
from .decryption import decryptData
import time
import asyncio
import json
import logging

cred = credentials.Certificate('serviceAccount.json')

firebase_admin.initialize_app(cred)

logger = logging.getLogger(__name__)

db = firestore.AsyncClient()

# Read the JSON file
with open('config.json') as f:
    config = json.load(f)

COLLECTION_TRADES = config["COLLECTION_TRADES"]
COLLECTION_PLANS = config["COLLECTION_PLANS"]
COLLECTION_TAKE_PROFITS = config["COLLECTION_TAKE_PROFITS"]
COLLECTION_STOP_LOSSES = config["COLLECTION_STOP_LOSSES"]
COLLECTION_WORKERS = config["COLLECTION_WORKERS"]
FIELD_TRADE_ID = config["FIELD_TRADE_ID"]
FIELD_ORDER_ID = config["FIELD_ORDER_ID"]
FIELD_EXECUTED = config["FIELD_EXECUTED"]
FIELD_SYMBOL = config["FIELD_SYMBOL"]
FIELD_ORDER_TYPE = config["FIELD_ORDER_TYPE"]
FIELD_SIDE = config["FIELD_SIDE"]
FIELD_QUANTITY = config["FIELD_QUANTITY"]
FIELD_ENTRY = config["FIELD_ENTRY"]
FIELD_LEVERAGE = config["FIELD_LEVERAGE"]
FIELD_MARGIN = config["FIELD_MARGIN"]
FIELD_EXCHANGE = config["FIELD_EXCHANGE"]
FIELD_CREATED_AT = config["FIELD_CREATED_AT"]
FIELD_TP_NUMBER = config["FIELD_TP_NUMBER"]
FIELD_TP_VALUE = config["FIELD_TP_VALUE"]
FIELD_TP_PERCENTAGE = config["FIELD_TP_PERCENTAGE"]
FIELD_TP_AMOUNT = config["FIELD_TP_AMOUNT"]
FIELD_SL_NUMBER = config["FIELD_SL_NUMBER"]
FIELD_SL_VALUE = config["FIELD_SL_VALUE"]
FIELD_SL_PERCENTAGE = config["FIELD_SL_PERCENTAGE"]
FIELD_SL_AMOUNT = config["FIELD_SL_AMOUNT"]

def refresh_globals_from_config():
    global COLLECTION_TRADERS
    
    with open('config.json') as f:
        config = json.load(f)

    COLLECTION_TRADERS = config["COLLECTION_TRADERS"]

def change_collection(collection):
    # Read the JSON file
    with open('config.json') as f:
        config = json.load(f)
    
    # Modify the COLLECTION_TRADERS variable
    config["COLLECTION_TRADERS"] = collection
    # Write the updated JSON back to the file
    with open('config.json', 'w') as f:
        json.dump(config, f)

    refresh_globals_from_config()
    return

# Function to check if trader exists
async def trader_check(traderId):
    try:
        document_ref = db.collection(COLLECTION_TRADERS).doc(traderId)
        document_snapshot = await document_ref.get()

        return document_snapshot.exists

    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)


# Store trade data in db
async def store_trade(account_id, order_dict):
    try:
        trade_doc_ref = db.collection(COLLECTION_TRADERS).document(account_id).collection(COLLECTION_TRADES).document(
            order_dict["trade_id"])
        await trade_doc_ref.set({
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
    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)

# Store take profit data in db
async def store_tp(account_id, tp_dict):
    try:
        tp_doc_ref = db.collection(COLLECTION_TRADERS).document(account_id).collection(COLLECTION_TRADES).document(
            tp_dict["trade_id"]).collection(COLLECTION_TAKE_PROFITS).document(tp_dict["tp_document_id"])
        await tp_doc_ref.set({
            FIELD_ORDER_ID: str(tp_dict["order_id"]),
            FIELD_EXECUTED: "1",
            FIELD_TP_NUMBER: tp_dict["tp_number"],
            FIELD_TP_VALUE: tp_dict["tp_value"],
            FIELD_TP_PERCENTAGE: tp_dict["tp_percentage"],
            FIELD_TP_AMOUNT: tp_dict["tp_amount"]
        })
    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)

# Store stop loss data in db
async def store_sl(account_id, sl_dict):
    sl_doc_ref = db.collection(COLLECTION_TRADERS).document(account_id).collection(COLLECTION_TRADES).document(
        sl_dict["trade_id"]).collection(COLLECTION_STOP_LOSSES).document(sl_dict["sl_document_id"])
    await sl_doc_ref.set({
        FIELD_ORDER_ID: str(sl_dict["order_id"]),
        FIELD_EXECUTED: "1",
        FIELD_SL_PERCENTAGE: sl_dict["sl_percentage"],
        FIELD_SL_NUMBER: sl_dict["sl_number"],
        FIELD_SL_VALUE: sl_dict["sl_value"],
        FIELD_SL_AMOUNT: sl_dict['sl_amount']
    })

# Delete single order from db
async def delete_order(account_id, trade_id):
    try:
        await db.collection(COLLECTION_TRADERS).document(account_id).collection(COLLECTION_TRADES).document(trade_id).delete()
    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)

# Delete single take profit or stop loss from db
async def delete_tp_sl_order(account_id, trade_id, document_id, is_tp_or_sl):
    try:
        if is_tp_or_sl == "tp":
            await db.collection(COLLECTION_TRADERS).document(account_id).collection(COLLECTION_TRADES).document(
                trade_id).collection(COLLECTION_TAKE_PROFITS).document(document_id).delete()
        if is_tp_or_sl == "sl":
            await db.collection(COLLECTION_TRADERS).document(account_id).collection(COLLECTION_TRADES).document(
                trade_id).collection(COLLECTION_STOP_LOSSES).document(document_id).delete()
    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)

# Get user api keys for a specific exchange
async def get_user_keys(account_id, exchange):
    try:
        keys = db.collection(COLLECTION_TRADERS).document(account_id)
        exchange_data = (await keys.get()).to_dict()["exchanges"][exchange]
        exchange_data['api_secret'] = await decryptData(account_id, exchange_data['api_secret'])

        # Decrypt the api_passphrase if encrypted
        if 'api_passphrase' in exchange_data:
            exchange_data['api_passphrase'] = await decryptData(account_id, exchange_data['api_passphrase'])

        return exchange_data
    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)

# Get user margin from a specific user and plan
async def get_user_margin(account_id, plan_id):
    try:
        plan = db.collection(COLLECTION_TRADERS).document(account_id).collection(COLLECTION_PLANS).document(plan_id)
        margin = (await plan.get()).to_dict()["margin"]
        return margin
    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)

# get user plans from firestore with account_id and exchange
async def get_user_plan(account_id, plan_id, trader_id):
    try:
        plan = db.collection(COLLECTION_TRADERS).document(account_id).collection(COLLECTION_PLANS).document(plan_id).collection(COLLECTION_WORKERS).document(trader_id)
        plan_object = (await plan.get()).to_dict()
        return plan_object
    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)

# Get trade related info for a specific tradeId
async def get_trade_info(account_id, trade_id):
    try:
        # Get general trade info from firestore with account_id and trade_id
        trade_info = (await db.collection(COLLECTION_TRADERS).document(account_id).collection(COLLECTION_TRADES).document(
            trade_id).get()).to_dict()
        return trade_info
    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)

# Get specific tp/sl order document
async def get_specific_order(account_id, trade_id, document_id, trade_type):
    try:
        trade_ref = db.collection(COLLECTION_TRADERS).document(account_id).collection(COLLECTION_TRADES).document(trade_id)

        collection_name = COLLECTION_TAKE_PROFITS if trade_type == 'tp' else COLLECTION_STOP_LOSSES

        order_doc_ref = trade_ref.collection(collection_name).document(document_id)
        order_doc = await order_doc_ref.get()

        if order_doc.exists:
            order_data = order_doc.to_dict()
            order_data['document_id'] = order_doc.id
            order_data['trade_type'] = trade_type
            return order_data
        else:
            return None
    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)

# Get take profit or stop loss info
async def get_tp_sl_info(account_id, trade_id, document_id, is_tp_or_sl):
    try:
        tp_sl_info = ""
        if is_tp_or_sl == "tp":
            tp_sl_info = (await db.collection(COLLECTION_TRADERS).document(account_id).collection(COLLECTION_TRADES).document(
                trade_id).collection(COLLECTION_TAKE_PROFITS).document(document_id).get()).to_dict()
        if is_tp_or_sl == "sl":
            tp_sl_info = (await db.collection(COLLECTION_TRADERS).document(account_id).collection(COLLECTION_TRADES).document(
                trade_id).collection(COLLECTION_STOP_LOSSES).document(document_id).get()).to_dict()
        return tp_sl_info
    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)

# Check executed status of a specific order
async def check_executed_status(account_id, trade_id, document_id, is_tp_or_sl):
    try:
        if is_tp_or_sl == "tp":
            executed_info = (await db.collection(COLLECTION_TRADERS).document(account_id).collection(COLLECTION_TRADES).document(
                trade_id).collection(COLLECTION_TAKE_PROFITS).document(document_id).get()).to_dict()["executed"]
        if is_tp_or_sl == "sl":
            executed_info = (await db.collection(COLLECTION_TRADERS).document(account_id).collection(COLLECTION_TRADES).document(
                trade_id).collection(COLLECTION_STOP_LOSSES).document(document_id).get()).to_dict()["executed"]
        else:
            executed_info = None
        return executed_info
    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)

# Update quantity field for a specific order
async def update_trade_quantity(account_id, trade_id, new_quantity):
    try:
        trade_ref = db.collection(COLLECTION_TRADERS).document(account_id).collection(COLLECTION_TRADES).document(trade_id)
        
        await trade_ref.update({'quantity': new_quantity})
        return f"Trade quantity successfully updated to {new_quantity}"
    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)

# Change executed status of take profit or stop loss
async def change_executed_status_tp_sl(account_id, trade_id, document_id, is_tp_or_sl, status):
    try:
        if is_tp_or_sl == "tp":
            tp_doc_ref = db.collection(COLLECTION_TRADERS).document(account_id).collection(COLLECTION_TRADES).document(
                trade_id).collection(COLLECTION_TAKE_PROFITS).document(document_id)
            await tp_doc_ref.update({FIELD_EXECUTED: str(status)})
        if is_tp_or_sl == "sl":
            sl_doc_ref = db.collection(COLLECTION_TRADERS).document(account_id).collection(COLLECTION_TRADES).document(
                trade_id).collection(COLLECTION_STOP_LOSSES).document(document_id)
            await sl_doc_ref.update({
                FIELD_EXECUTED: str(status)
            })
    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)

# Async function to get all take profit orders for a trade
async def get_tp_orders(account_id, trade_id):
    try:
        trade_ref = db.collection(COLLECTION_TRADERS).document(account_id).collection(COLLECTION_TRADES).document(trade_id)

        tp_collection = await trade_ref.collection(COLLECTION_TAKE_PROFITS).get()

        tp_orders = []

        for doc in tp_collection:
            tp_data = doc.to_dict()
            tp_data['documentId'] = doc.id
            tp_data['tradeType'] = 'tp'
            tp_orders.append(tp_data)

        return tp_orders
    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)

# Get take profit and stop loss orders from firestore with account_id and trade_id
async def get_tp_sl_orders(account_id, trade_id):
    try:
        tp_sl_orders = []

        tp_collection_task = db.collection(COLLECTION_TRADERS).document(account_id).collection(COLLECTION_TRADES).document(
            trade_id).collection(COLLECTION_TAKE_PROFITS).get()
        sl_collection_task = db.collection(COLLECTION_TRADERS).document(account_id).collection(COLLECTION_TRADES).document(
            trade_id).collection(COLLECTION_STOP_LOSSES).get()

        tp_collection, sl_collection = await asyncio.gather(tp_collection_task, sl_collection_task)

        for tp_doc in tp_collection:
            tp_data = tp_doc.to_dict()
            tp_data['document_id'] = tp_doc.id  # Add document ID to the dictionary
            tp_data['trade_type'] = "tp"
            tp_sl_orders.append(tp_data)

        for sl_doc in sl_collection:
            sl_data = sl_doc.to_dict()
            sl_data['document_id'] = sl_doc.id  # Add document ID to the dictionary
            sl_data['trade_type'] = "sl"
            tp_sl_orders.append(sl_data)

        return tp_sl_orders
    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)