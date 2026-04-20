import firebase_admin
from firebase_admin import credentials, firestore
import requests
import json
import urllib.parse

# Initialize Firebase
cred = credentials.Certificate('admin_portal/service-account.json')
firebase_admin.initialize_app(cred)
db = firestore.client()

GOOGLE_API_KEY = "AIzaSyB8Pvs-P4580Wsk4mT46cvGT7TGlZiLkWo"

print("Fetching kermes_events...")
events = db.collection(u'kermes_events').stream()

for doc in events:
    data = doc.to_dict()
    lat = data.get('latitude')
    lng = data.get('longitude')
    
    if lat is None or lat == 0.0 or lat == 51.0:
        full_address = ""
        addr = data.get('address')
        if isinstance(addr, dict) and 'fullAddress' in addr:
            full_address = addr['fullAddress']
        elif isinstance(addr, str):
            full_address = addr
        elif data.get('street'):
            street = data.get('street', '')
            postal = data.get('postalCode', '')
            city = data.get('city', '')
            country = data.get('country', '')
            full_address = f"{street}, {postal} {city}, {country}".strip()
            
        if not full_address and data.get('city'):
            full_address = data.get('city')
            
        if full_address:
            print(f"Geocoding: {full_address}")
            url = f"https://maps.googleapis.com/maps/api/geocode/json?address={urllib.parse.quote(full_address)}&key={GOOGLE_API_KEY}"
            try:
                res = requests.get(url)
                res_data = res.json()
                if res_data['status'] == 'OK' and len(res_data['results']) > 0:
                    loc = res_data['results'][0]['geometry']['location']
                    print(f"Resolved {doc.id} ({full_address}) -> {loc['lat']}, {loc['lng']}")
                    doc.reference.update({
                        u'latitude': loc['lat'],
                        u'longitude': loc['lng']
                    })
                    print(f"Updated {doc.id}")
                else:
                    print(f"Failed Geocoding for {full_address}: {res_data['status']}")
            except Exception as e:
                print(f"Error: {e}")

print("Done")
