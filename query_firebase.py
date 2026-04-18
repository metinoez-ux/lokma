import firebase_admin
from firebase_admin import credentials, firestore

cred = credentials.Certificate('admin_portal/firebase-service-account.json')
firebase_admin.initialize_app(cred)
db = firestore.client()

docs = db.collection('businesses').where('name', '==', 'Tuna Kebaphaus & Pizzeria').stream()
for doc in docs:
    d = doc.to_dict()
    print(doc.id, '-> activeBrandIds:', d.get('activeBrandIds'), '| isTunaPartner:', d.get('isTunaPartner'), '| brand:', d.get('brand'), '| brandLabel:', d.get('brandLabel'))
