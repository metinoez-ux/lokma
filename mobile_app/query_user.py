import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore

cred = credentials.Certificate("/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/service-account.json")
firebase_admin.initialize_app(cred)

db = firestore.client()
doc = db.collection('admins').document('v445u4EsvYfoTwUu8IKDDsarVOq2').get()
print(doc.to_dict())
