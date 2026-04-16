import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore

cred = credentials.Certificate("/Users/metinoz/Developer/LOKMA_MASTER/tuna_firebase_service_account.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

kermes_ref = db.collection('kermes_events').order_by('createdAt', direction=firestore.Query.DESCENDING).limit(1)
docs = list(kermes_ref.stream())
if docs:
    k_id = docs[0].id
    k_data = docs[0].to_dict()
    print("Kermes:", k_data.get('name'))
    print("V2:", k_data.get('tableSectionsV2'))
    print("DZ:", k_data.get('deliveryZones'))
    
    orders = db.collection('kermes_orders').where('kermesId', '==', k_id).order_by('createdAt', direction=firestore.Query.DESCENDING).limit(5).stream()
    for o in orders:
        od = o.to_dict()
        print("---- Order ----")
        print("ID:", o.id)
        print("tableSection:", od.get('tableSection'))
        items = od.get('items', [])
        for i in items:
            print("  Item:", i.get('name'), "prepZones:", i.get('prepZones'))

