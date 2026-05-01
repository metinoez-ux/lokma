import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore

cred = credentials.Certificate("/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/service-account.json")
firebase_admin.initialize_app(cred)

db = firestore.client()
docs = db.collection('meat_orders').get()
print(f"Total meat_orders: {len(docs)}")
