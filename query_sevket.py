import firebase_admin
from firebase_admin import credentials, firestore

cred = credentials.Certificate('admin_portal/service-account.json')
firebase_admin.initialize_app(cred)
db = firestore.client()

docs = db.collection('admins').stream()
for doc in docs:
    d = doc.to_dict()
    name = d.get('name') or d.get('firstName') or ''
    if 'Sevket' in name or 'evket' in name:
        print(doc.id, '->', d)
