import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore

cred = credentials.Certificate('./admin_portal/service-account.json')
firebase_admin.initialize_app(cred)

db = firestore.client()
docs = db.collection('platform_brands').stream()
for doc in docs:
    data = doc.to_dict()
    print(f"Brand ID: {doc.id} - Name: {data.get('name')}")
    
