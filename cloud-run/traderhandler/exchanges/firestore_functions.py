from google.cloud import firestore

db = firestore.Client()


# store trade data in firestore
def store_trade_data(uuid, symbol, entry, trade_id):
    doc_ref = db.collection("users").document(uuid).collection("trades").document(trade_id)
    doc_ref.set({
        "entry": entry,
        "symbol": symbol,
        "tradeID": trade_id
    })


# store take profit data in firestore
def store_tp_data(uuid, symbol, trade_id, tp):
    doc_ref = db.collection("users").document(uuid).collection("trades").document(trade_id).collection("tp").document(
        trade_id)
    doc_ref.set({
        "symbol": symbol,
        "tp": tp
    })


# store stop loss data in firestore
def store_sl_data(uuid, symbol, trade_id, sl):
    doc_ref = db.collection("users").document(uuid).collection("trades").document(trade_id).collection("sl").document(
        trade_id)
    doc_ref.set({
        "symbol": symbol,
        "sl": sl
    })


# delete single order from firestore
def delete_order(uuid, trade_id):
    db.collection("users").document(uuid).collection("trades").document(trade_id).delete()


# delete all orders from firestore
def delete_all_orders(uuid):
    db.collection("users").document(uuid).collection("trades").stream().delete()
