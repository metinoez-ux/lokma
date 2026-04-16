const fs = require('fs');
const path = require('path');

const arbs = ['tr.json', 'de.json', 'nl.json', 'en.json', 'fr.json', 'it.json', 'es.json'];
const newVals = {
  "supply_alarm_title": "Malzeme Alarmı",
  "supply_quick_request": "Hızlı Malzeme İste",
  "supply_categories": "Mutfak/Tedarik Kategorileri",
  "supply_custom_item_hint": "Özel Malzeme Yazın...",
  "supply_request_btn": "Talep Et",
  "supply_no_items": "Sisteme henüz hazır malzeme tanımlanmamış.",
  "supply_live_list": "Canlı İhtiyaç Listesi",
  "supply_status_on_the_way": "Yola Çıktı",
  "supply_status_pending": "Acil Bekliyor",
  "supply_status_completed": "Tamamlandı",
  "supply_already_requested": "zaten az önce istendi!",
  "supply_request_sent": "Talebiniz iletildi:",
  "supply_btn_title": "Malzeme Belirt / Alarm Ver"
};

for (const arb of arbs) {
  const p = path.join(__dirname, 'assets/translations', arb);
  if (fs.existsSync(p)) {
      let data = JSON.parse(fs.readFileSync(p, 'utf8'));
      for (const [k, v] of Object.entries(newVals)) {
          if (!data[k]) data[k] = v;
      }
      fs.writeFileSync(p, JSON.stringify(data, null, 2));
  }
}
console.log("JSON updated.");
