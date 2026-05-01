import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore

cred = credentials.Certificate("/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/service-account.json")
firebase_admin.initialize_app(cred)

db = firestore.client()
docs = db.collection('meat_orders').where('butcherId', '==', 'KjdsF3N5ACtEKfTprwJW').get()
for doc in docs:
    data = doc.to_dict()
    status = data.get('status')
    if status in ['ready', 'preparing', 'pending', 'onTheWay', 'accepted']:
        print(f"ID: {doc.id} | status: {status} | courierId: {data.get('courierId')} | deliveryMethod: {data.get('deliveryMethod')}")
