const fs = require('fs');
const path = require('path');

const messagesDir = path.join(__dirname, '../messages');
const files = fs.readdirSync(messagesDir).filter(f => f.endsWith('.json'));

const newKeys = {
  kermes_supply_management_title: "Malzeme Tedarik ve Kiler Yönetimi",
  kermes_supply_category_defs: "Kategori Tanımları",
  kermes_supply_category_desc: "Sisteme yeni tedarik kategorileri (örn: Mutfak Eşyası, Sebze) ve alt malzemeleri (Bardak, Kumpir Patates) ekleyin.",
  kermes_supply_category_name: "Kategori Adı",
  kermes_supply_add_category: "Kategori Ekle",
  kermes_supply_new_item: "Yeni Malzeme...",
  kermes_supply_add_btn: "Ekle",
  kermes_supply_live_requests: "Canlı İhtiyaç Talepleri",
  kermes_supply_delete: "Sil",
  kermes_supply_dispatch: "Yola Çıkart",
  kermes_supply_mark_completed: "Tamamlandı İşaretle",
  supply_alarm_title: "Malzeme Alarmı",
  supply_quick_request: "Hızlı Malzeme İste",
  supply_categories: "Mutfak/Tedarik Kategorileri",
  supply_custom_item_hint: "Özel Malzeme Yazın...",
  supply_request_btn: "Talep Et",
  supply_no_items: "Sisteme henüz hazır malzeme tanımlanmamış.",
  supply_live_list: "Canlı İhtiyaç Listesi",
  supply_status_on_the_way: "Yola Çıktı",
  supply_status_pending: "Acil Bekliyor",
  supply_status_completed: "Tamamlandı"
};

for (const file of files) {
  const filePath = path.join(messagesDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  if (!data.kermes) {
     data.kermes = {};
  }
  
  let modified = false;
  for (const [key, value] of Object.entries(newKeys)) {
    if (!data.kermes[key]) {
      // Very basic fallback: just use TR strings if not defined
      data.kermes[key] = value;
      modified = true;
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`Updated ${file}`);
  }
}
