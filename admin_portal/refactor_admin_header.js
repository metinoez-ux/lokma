const fs = require('fs');
const path = require('path');

const targetFile = 'src/components/admin/AdminHeader.tsx';
let content = fs.readFileSync(targetFile, 'utf8');

const replacements = {
    "'👑 Super Admin'": "t('superAdmin')",
    "'🎪 Kermes Admin'": "t('kermesAdmin')",
    "'🎪 Kermes Personel'": "t('kermesStaff')",
    "'⚫ Cenaze Fonu'": "t('cenazeFonu')",
    "'🍽️ Restoran Sahibi'": "t('restoranAdmin')",
    "'👨‍🍳 Restoran Personel'": "t('restoranStaff')",
    "'👨‍🍳 Mutfak'": "t('mutfak')",
    "'🧑‍💼 Garson'": "t('garson')",
    "'🚗 Teslimat'": "t('teslimat')",
    "'🥩 Kasap Sahibi'": "t('kasapAdmin')",
    "'👷 Kasap Personel'": "t('kasapStaff')",
    "'🏪 Bakkal'": "t('bakkal')",
    "'🛒 Market Sahibi'": "t('marketAdmin')",
    "'🛒 Market Personel'": "t('marketStaff')",
    "'🧹 Halı Yıkama'": "t('haliYikama')",
    "'🛵 Halı Sürücü'": "t('haliSurucu')",
    "'✈️ Transfer Sürücü'": "t('transferSurucu')",
    "'🗺️ Tur Rehberi'": "t('turRehberi')",
    "Hesabım": "{t('myAccount')}",
    "Çıkış Yap": "{t('logout')}",
    "👥 Tüm Kullanıcılar": "👥 {t('allUsers')}",
    "�� İşletme Adminleri": "🎫 {t('businessAdmins')}",
    "👷 Sub Adminler (Personel)": "👷 {t('subAdmins')}",
    "👑 Super Adminler": "👑 {t('superAdmins')}",
    "Kullanıcı bulunamadı": "{t('noUsersFound')}",
    "Admin bulunamadı": "{t('noAdminsFound')}",
    "İsimsiz": "{t('unnamed')}",
    // For string literals inside JS:
    "'İsimsiz'": "t('unnamed')",
    "'Profil'": "t('profile')",
    "Yükleniyor...": "{t('loading')}",
    "Onay Bekleyen Davetiyeler": "{t('pendingInvitations')}",
    "Bekleyen davetiye yok": "{t('noPendingInvitations')}",
    "Kayıt Tamamlandı": "{t('registrationComplete')}",
    "Link Bekleniyor": "{t('waitingForLink')}",
    "Rol:": "{t('roleLabel')}:",
    "İşletme:": "{t('businessLabel')}:",
    "Davet Eden:": "{t('invitedByLabel')}:",
    "Tarih:": "{t('dateLabel')}:",
    "✓ Onayla": "✓ {t('approve')}",
    "✗ Reddet": "✗ {t('reject')}",
    "Kapat": "{t('close')}",
    "title=\"Tüm Kullanıcılar\"": "title={t('allUsers')}",
    "title=\"İşletme Adminleri\"": "title={t('businessAdmins')}",
    "title=\"Sub Adminler (Personel)\"": "title={t('subAdmins')}",
    "title=\"Super Adminler\"": "title={t('superAdmins')}",
};

for (const [key, value] of Object.entries(replacements)) {
    content = content.replaceAll(key, value);
}

// Special case: title={`${totalBusinesses} İşletme`}
content = content.replace(/title=\{\`\$\{totalBusinesses\} İşletme\`\}/g, "title={`${totalBusinesses} ${t('businessLabel')}`}");
content = content.replace(/title=\{\`\$\{totalBusinesses\} İşletme\`\}/g, "title={`${totalBusinesses} ${t('businessLabel')}`}");
content = content.replace(/'İşletme'/g, "t('businessLabel')");

fs.writeFileSync(targetFile, content, 'utf8');

// Update TR JSON
const trJsonPath = 'messages/tr.json';
const trJson = JSON.parse(fs.readFileSync(trJsonPath, 'utf8'));

const newKeys = {
    superAdmin: '👑 Super Admin',
    kermesAdmin: '🎪 Kermes Admin',
    kermesStaff: '🎪 Kermes Personel',
    cenazeFonu: '⚫ Cenaze Fonu',
    restoranAdmin: '🍽️ Restoran Sahibi',
    restoranStaff: '👨‍🍳 Restoran Personel',
    mutfak: '👨‍🍳 Mutfak',
    garson: '🧑‍💼 Garson',
    teslimat: '🚗 Teslimat',
    kasapAdmin: '🥩 Kasap Sahibi',
    kasapStaff: '👷 Kasap Personel',
    bakkal: '🏪 Bakkal',
    marketAdmin: '🛒 Market Sahibi',
    marketStaff: '🛒 Market Personel',
    haliYikama: '🧹 Halı Yıkama',
    haliSurucu: '🛵 Halı Sürücü',
    transferSurucu: '✈️ Transfer Sürücü',
    turRehberi: '🗺️ Tur Rehberi',
    myAccount: 'Hesabım',
    logout: 'Çıkış Yap',
    allUsers: 'Tüm Kullanıcılar',
    businessAdmins: 'İşletme Adminleri',
    subAdmins: 'Sub Adminler (Personel)',
    superAdmins: 'Super Adminler',
    noUsersFound: 'Kullanıcı bulunamadı',
    noAdminsFound: 'Admin bulunamadı',
    unnamed: 'İsimsiz',
    profile: 'Profil',
    loading: 'Yükleniyor...',
    pendingInvitations: 'Onay Bekleyen Davetiyeler',
    noPendingInvitations: 'Bekleyen davetiye yok',
    registrationComplete: 'Kayıt Tamamlandı',
    waitingForLink: 'Link Bekleniyor',
    roleLabel: 'Rol',
    businessLabel: 'İşletme',
    invitedByLabel: 'Davet Eden',
    dateLabel: 'Tarih',
    approve: 'Onayla',
    reject: 'Reddet',
    close: 'Kapat'
};

trJson.AdminNav = { ...trJson.AdminNav, ...newKeys };

fs.writeFileSync(trJsonPath, JSON.stringify(trJson, null, 2), 'utf8');
console.log('AdminHeader refactored successfully.');
