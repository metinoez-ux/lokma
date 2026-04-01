import json

path = '/Users/metinoz/Developer/LOKMA_MASTER/mobile_app/assets/translations/tr.json'
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)

staff_data = {
    "reservations_title": "Rezervasyonlar",
    "guest": "Misafir",
    "filter_today": "Bugün",
    "filter_tomorrow": "Yarın",
    "filter_this_week": "Bu Hafta",
    "filter_all": "Tümü",
    "status_waiting": "Bekleyen",
    "status_confirmed_short": "Onaylandı",
    "status_rejected_short": "Reddedildi",
    "status_cancelled_short": "İptal",
    "no_business_assigned": "Atanmış Bir İşletme Bulunamadı",
    "must_be_assigned": "Rezervasyonları yönetmek için bir işletmeye atanmalısınız",
    "no_reservations_filter": "Seçilen filtrede rezervasyon yok",
    "reject": "Reddet",
    "cancel_reservation": "Rezervasyonu İptal Et",
    "table_card_select_title": "Masa Seçimi",
    "table_card_select_desc": "Müşteri için masa seçin",
    "table_card_selected": "Seçili",
    "table_card_empty": "Boş",
    "table_card_full": "Dolu",
    "select_number": "Masa Seçin",
    "confirm_tables": "{count} Masa Onayla",
    "reservation_confirmed": "Rezervasyon Onaylandı",
    "confirm_reject_title": "Rezervasyonu Reddet",
    "confirm_cancel_title": "Rezervasyonu İptal Et",
    "confirm_reject_msg": "Bu rezervasyonu reddetmek istediğinize emin misiniz?",
    "confirm_cancel_msg": "Bu rezervasyonu iptal etmek istediğinize emin misiniz?",
    "reservation_rejected": "Rezervasyon Reddedildi",
    "reservation_cancelled": "Rezervasyon İptal Edildi",
    "person_count": "{count} Kişi",
    "table_numbers": "Masa {numbers}",
    "staff": "Personel",
    "customer_seated_marked": "Müşteri masaya oturdu olarak işaretlendi",
    "no_reservation_found": "Rezervasyon bulunamadı",
    "no_reservation_today": "Bugün için rezervasyon yok",
    "no_reservation_timerange": "Seçili tarih aralığında rezervasyon yok",
    "approve": "Onayla",
    "customer_arrived_seat": "Müşteri Geldi (Masaya Oturt)",
    "customer_at_table": "Müşteri Masada"
}

if "staff" not in data:
    data["staff"] = {}

data["staff"].update(staff_data)

with open(path, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("JSON updated successfully")
