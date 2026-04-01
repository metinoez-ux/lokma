import json
import os

filepath = '/Users/metinoz/Developer/LOKMA_MASTER/mobile_app/assets/translations/tr.json'
with open(filepath, 'r', encoding='utf-8') as f:
    data = json.load(f)

if 'staff' not in data:
    data['staff'] = {}

new_staff_keys = {
  "no_business_assigned": "Atanmış Bir İşletme Bulunamadı",
  "business_assignment_required": "Sipariş almak için bir işletmeye atanmış olmanız gerekir.",
  "business": "İşletme",
  "select_table_for_order": "Sipariş alacağınız masayı seçin",
  "has_orders": "Siparişli",
  "paid": "Ödendi",
  "reserved": "Rezerveli",
  "empty": "Boş",
  "open": "Açık",
  "total": "Toplam",
  "filter_all": "Tümü",
  "continue_with_tables": "{count} Masa ile Devam Et",
  "orders_paid_count": "{total} sipariş • {paid}/{total} ödendi",
  "search_in_menu": "Menüde ara...",
  "loading_menu": "Menü yükleniyor...",
  "item_not_found": "Ürün bulunamadı",
  "send_to_kitchen_count": "Mutfağa Gönder • {count} ürün •",
  "table_and_waiter": "Masa {table} • {waiter}",
  "table": "Masa",
  "no_active_table_permission": "Aktif masa yetkiniz yok.",
  "active_tables_count": "Aktif Masalar ({count})",
  "busy": "Meşgul",
  "waiter": "Garson",
  "waiter_and_pin": "Garson: {waiter} • PIN: {pin}"
}

data['staff'].update(new_staff_keys)

with open(filepath, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("Updated tr.json successfully")
