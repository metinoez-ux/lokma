const fs = require('fs');
const path = './messages/tr.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

if (!data.AdminStaffdashboard) data.AdminStaffdashboard = {};
data.AdminStaffdashboard.durdurma_sayisi = "Durdurma Sayısı";
data.AdminStaffdashboard.devam_ettirme = "Devam Ettirme";
data.AdminStaffdashboard.toplam_durma_suresi = "Toplam Durma Süresi";
data.AdminStaffdashboard.benzersiz_musteri = "Benzersiz Müşteri";

if (!data.AdminBusiness) data.AdminBusiness = {};
data.AdminBusiness.aktifKuryeYok = "Aktif kurye yok.";
data.AdminBusiness.canli_operasyon_akisi = "Canlı Operasyon Akışı";
data.AdminBusiness.siparislerin_anlik_durumu = "Siparişlerin anlık durumu";

if (!data.AdminStatistics) data.AdminStatistics = {};
data.AdminStatistics.son_7_gun_trend_analizi = "Son 7 Gün Trend Analizi";

fs.writeFileSync(path, JSON.stringify(data, null, 2));
console.log("Added keys to tr.json");
