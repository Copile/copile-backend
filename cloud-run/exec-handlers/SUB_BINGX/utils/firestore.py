from google.cloud import firestore
from .decryption import decrypt_data
import time
import asyncio

db = firestore.AsyncClient()

COLLECTION_SUB_BINGX  = "sub_bingx"
COLLECTION_TRADERS = "traders"
COLLECTION_TRADES = "trades"
COLLECTION_PLANS = "plans"
COLLECTION_WORKERS = "workers"
COLLECTION_TAKE_PROFITS = "take-profits"
COLLECTION_STOP_LOSSES = "stop-losses"
FIELD_ACCOUNT_NICKNAME = "account_nickname"
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
FIELD_CREATED_AT = "created_at"
FIELD_TP_PRICE = "tp"
FIELD_SL_PRICE = "sl"
FIELD_TP_NUMBER = "tp_number"
FIELD_TP_VALUE = "tp_value"
FIELD_TP_PERCENTAGE = "tp_percentage"
FIELD_TP_AMOUNT = "tp_amount"
FIELD_SL_NUMBER = "sl_number"
FIELD_SL_VALUE = "sl_value"
FIELD_SL_PERCENTAGE = "sl_percentage"
FIELD_SL_AMOUNT = "sl_amount"

# Get mt5 nickname from db
async def get_nickname(trader_id, meta_id):
    try:
        meta_acc_ref = db.collection(COLLECTION_TRADERS).document(trader_id).collection(COLLECTION_SUB_BINGX).document(meta_id)
        meta_acc_info = (await meta_acc_ref.get()).to_dict()
        return meta_acc_info["nickname"]
    except Exception as e:
        raise e

# Store trade data in db
async def store_trade(trader_id, meta_id, order_dict):
    try:
        trade_doc_ref = db.collection(COLLECTION_TRADERS).document(trader_id).collection(COLLECTION_SUB_BINGX).document(meta_id).collection(COLLECTION_TRADES).document(
            order_dict["trade_id"])
        await trade_doc_ref.set({
            FIELD_ACCOUNT_NICKNAME: await get_nickname(trader_id, meta_id),
            FIELD_TRADE_ID: str(order_dict["trade_id"]),
            FIELD_ORDER_ID: order_dict["order_id"],
            FIELD_SYMBOL: order_dict["symbol"],
            FIELD_ORDER_TYPE: order_dict["type"],
            FIELD_SIDE: order_dict["side"],
            FIELD_QUANTITY: order_dict["quantity"],
            FIELD_ENTRY: order_dict["entry"],
            FIELD_LEVERAGE: order_dict["leverage"],
            FIELD_MARGIN: order_dict["margin"],
            FIELD_EXCHANGE: order_dict["exchange"],
            FIELD_CREATED_AT: int(time.time()),
        })
    except Exception as e:
        raise e

# Store take profit data in db
async def store_tp(trader_id, meta_id, tp_dict):
    try:
        tp_doc_ref = db.collection(COLLECTION_TRADERS).document(trader_id).collection(COLLECTION_SUB_BINGX).document(meta_id).collection(COLLECTION_TRADES).document(
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
        raise e

# Store stop loss data in db
async def store_sl(trader_id, meta_id, sl_dict):
    try:
        sl_doc_ref = db.collection(COLLECTION_TRADERS).document(trader_id).collection(COLLECTION_SUB_BINGX).document(meta_id).collection(COLLECTION_TRADES).document(
            sl_dict["trade_id"]).collection(COLLECTION_STOP_LOSSES).document(sl_dict["sl_document_id"])
        await sl_doc_ref.set({
            FIELD_ORDER_ID: str(sl_dict["order_id"]),
            FIELD_EXECUTED: "1",
            FIELD_SL_PERCENTAGE: sl_dict["sl_percentage"],
            FIELD_SL_NUMBER: sl_dict["sl_number"],
            FIELD_SL_VALUE: sl_dict["sl_value"],
            FIELD_SL_AMOUNT: sl_dict['sl_amount']
        })
    except Exception as e:
        raise e

# Delete single order from db
async def delete_order(trader_id, meta_id, trade_id):
    try:
        await db.collection(COLLECTION_TRADERS).document(trader_id).collection(COLLECTION_SUB_BINGX).document(meta_id).collection(COLLECTION_TRADES).document(
            trade_id).delete()
    except Exception as e:
        raise e


# Delete single take profit or stop loss from db
async def delete_tp_sl_order(trader_id, meta_id, trade_id, document_id, is_tp_or_sl):
    try:
        if is_tp_or_sl == "tp":
            await db.collection(COLLECTION_TRADERS).document(trader_id).collection(COLLECTION_SUB_BINGX).document(meta_id).collection(COLLECTION_TRADES).document(
                trade_id).collection(COLLECTION_TAKE_PROFITS).document(document_id).delete()
        if is_tp_or_sl == "sl":
            await db.collection(COLLECTION_TRADERS).document(trader_id).collection(COLLECTION_SUB_BINGX).document(meta_id).collection(COLLECTION_TRADES).document(
                trade_id).collection(COLLECTION_STOP_LOSSES).document(document_id).delete()
    except Exception as e:
        raise e


# Get user api keys for a specific exchange
async def get_user_keys(trader_id, meta_id):
    try:
        keys = db.collection(COLLECTION_TRADERS).document(trader_id).collection(COLLECTION_SUB_BINGX).document(meta_id)
        
        keys_info = (await keys.get()).to_dict()
        api_key = keys_info["api_key"]
        api_secret = await decrypt_data(trader_id, keys_info["api_secret"])

        account_data = {
            "api_key": api_key,
            "api_secret": api_secret
        }

        return account_data
    except Exception as e:
        raise e

# Get trade related info for a specific tradeId
async def get_trade_info(trader_id, meta_id, trade_id):
    try:
        # Get general trade info from firestore with account_id and trade_id
        trade_info = (
            await db.collection(COLLECTION_TRADERS).document(trader_id).collection(COLLECTION_SUB_BINGX).document(meta_id).collection(COLLECTION_TRADES).document(
                trade_id).get()).to_dict()
        return trade_info
    except Exception as e:
        raise e


# Get specific tp/sl order document
async def get_specific_order(trader_id, meta_id, trade_id, document_id, trade_type):
    try:
        trade_ref = db.collection(COLLECTION_TRADERS).document(trader_id).collection(COLLECTION_SUB_BINGX).document(meta_id).collection(COLLECTION_TRADES).document(
            trade_id)

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
        raise e


# Get take profit or stop loss info
async def get_tp_sl_info(trader_id, meta_id, trade_id, document_id, is_tp_or_sl):
    try:
        tp_sl_info = ""
        if is_tp_or_sl == "tp":
            tp_sl_info = (
                await db.collection(COLLECTION_TRADERS).document(trader_id).collection(COLLECTION_SUB_BINGX).document(meta_id).collection(COLLECTION_TRADES).document(
                    trade_id).collection(COLLECTION_TAKE_PROFITS).document(document_id).get()).to_dict()
        if is_tp_or_sl == "sl":
            tp_sl_info = (
                await db.collection(COLLECTION_TRADERS).document(trader_id).collection(COLLECTION_SUB_BINGX).document(meta_id).collection(COLLECTION_TRADES).document(
                    trade_id).collection(COLLECTION_STOP_LOSSES).document(document_id).get()).to_dict()
        return tp_sl_info
    except Exception as e:
        raise e
    

# Check executed status of a specific order
async def check_executed_status(trader_id, meta_id, trade_id, document_id, is_tp_or_sl):
    try:
        if is_tp_or_sl == "tp":
            executed_info = \
                (await db.collection(COLLECTION_TRADERS).document(trader_id).collection(COLLECTION_SUB_BINGX).document(meta_id).collection(COLLECTION_TRADES).document(
                    trade_id).collection(COLLECTION_TAKE_PROFITS).document(document_id).get()).to_dict()["executed"]
        if is_tp_or_sl == "sl":
            executed_info = \
                (await db.collection(COLLECTION_TRADERS).document(trader_id).collection(COLLECTION_SUB_BINGX).document(meta_id).collection(COLLECTION_TRADES).document(
                    trade_id).collection(COLLECTION_STOP_LOSSES).document(document_id).get()).to_dict()["executed"]
        else:
            executed_info = None
        return executed_info
    except Exception as e:
        raise e


# Update quantity field for a specific order
async def update_trade_quantity_margin(trader_id, meta_id, trade_id, new_quantity, new_margin):
    try:
        trade_ref = db.collection(COLLECTION_TRADERS).document(trader_id).collection(COLLECTION_SUB_BINGX).document(meta_id).collection(COLLECTION_TRADES).document(
            trade_id)

        await trade_ref.update({'quantity': new_quantity, 'margin': new_margin})
        return f"Trade quantity successfully updated to {new_quantity}"
    except Exception as e:
        raise e

# Update either the tp or sl of a trade
async def update_tp_sl_price(trader_id, meta_id, trade_id, new_price, is_tp_or_sl):
    try:
        trade_ref = db.collection(COLLECTION_TRADERS).document(trader_id).collection(COLLECTION_SUB_BINGX).document(meta_id).collection(COLLECTION_TRADES).document(
            trade_id)
        await trade_ref.update({'tp': new_price}) if is_tp_or_sl == 'tp' else await trade_ref.update({'sl': new_price})
    except Exception as e:
        raise e

# Async function to get all take profit orders for a trade
async def get_tp_orders(trader_id, meta_id, trade_id):
    try:
        trade_ref = db.collection(COLLECTION_TRADERS).document(trader_id).collection(COLLECTION_SUB_BINGX).document(meta_id).collection(COLLECTION_TRADES).document(
            trade_id)

        tp_collection = await trade_ref.collection(COLLECTION_TAKE_PROFITS).get()

        tp_orders = []

        for doc in tp_collection:
            tp_data = doc.to_dict()
            tp_data['document_id'] = doc.id
            tp_data['trade_type'] = 'tp'
            tp_orders.append(tp_data)

        return tp_orders
    except Exception as e:
        raise e
    

# Get take profit and stop loss orders from firestore with account_id and trade_id
async def get_tp_sl_orders(trader_id, meta_id, trade_id):
    try:
        tp_sl_orders = []

        tp_collection_task = db.collection(COLLECTION_TRADERS).document(trader_id).collection(COLLECTION_SUB_BINGX).document(meta_id).collection(
            COLLECTION_TRADES).document(
            trade_id).collection(COLLECTION_TAKE_PROFITS).get()
        sl_collection_task = db.collection(COLLECTION_TRADERS).document(trader_id).collection(COLLECTION_SUB_BINGX).document(meta_id).document(trader_id).collection(
            COLLECTION_TRADES).document(
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
        raise e
