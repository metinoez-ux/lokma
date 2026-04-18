import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore

cred = credentials.Certificate('./admin_portal/service-account.json')
firebase_admin.initialize_app(cred)

db = firestore.client()
doc = db.collection('platform_brands').document('dYiMJo1dqBvp9bNoCiYu').get()
print(doc.to_dict())
