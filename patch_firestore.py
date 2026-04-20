import json
import urllib.request
import certifi
import ssl

context = ssl.create_default_context(cafile=certifi.where())

# Load service account credentials (assuming they are in the JSON file in admin_portal)
with open('admin_portal/serviceAccountKey.json') as f:
    creds = json.load(f)

# Wait. To do Firebase Admin operations in pure python without installing libraries:
# The easiest way is using `pip install firebase-admin googlemaps`
