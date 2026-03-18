import json
import os

files = ['es.json', 'fr.json', 'it.json', 'nl.json']
base_dir = '/Users/metinoz/.gemini/antigravity/scratch/LOKMA_2026/mobile_app/assets/translations/'

new_keys = {
    "cash_to_business": "Cash for Business",
    "cash_all_time": "All time ({} transactions)",
    "cash_since_last": "Since last reset: {}",
    "cash_reset_title": "Reset Cash",
    "cash_reset_confirm": "Do you confirm handing over a total of {} cash to the business?",
    "cash_reset_success": "Cash successfully reset and handed over to the business.",
    "cash_handover": "Handover"
}

for f in files:
    path = os.path.join(base_dir, f)
    with open(path, 'r', encoding='utf-8') as file:
        data = json.load(file)
    
    if "staff" not in data:
        data["staff"] = {}
        
    for k, v in new_keys.items():
        data["staff"][k] = v
        
    with open(path, 'w', encoding='utf-8') as file:
        json.dump(data, file, ensure_ascii=False, indent=2)

print("Updated fallback languages!")
