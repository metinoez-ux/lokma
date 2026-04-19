import json, sys

try:
    with open('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/service-account.json') as f:
        creds = json.load(f)
except Exception as e:
    print("Cannot read service account")
    sys.exit(1)

project_id = creds['project_id']
print(f"Project ID: {project_id}")
