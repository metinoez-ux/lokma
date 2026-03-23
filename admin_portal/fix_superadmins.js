const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/[locale]/admin/superadmins/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// We already have: const t = useTranslations('AdminNav');
// Change it to: const t = useTranslations('SuperAdmins');
content = content.replace("const t = useTranslations('AdminNav');", "const t = useTranslations('SuperAdmins');");

const translations = {
    'Super Admins': 'super_admins_title',
    'Plattform-Administratoren verwalten': 'plattform_adminleri_yonet',
    'Aktive Super Admins': 'aktif_super_adminler',
    'Keine Super Admins gefunden': 'super_admin_bulunamadi',
    'Profil bearbeiten': 'profili_duzenle',
    'Foto<br/>hinzufügen': 'foto_ekle',
    'Foto ändern': 'fotografi_degistir',
    'Name': 'isim',
    'Titel / Position': 'unvan_pozisyon',
    'Bio': 'biyografi',
    'Speichern...': 'kaydediliyor',
    'Speichern': 'kaydet',
    'Abbrechen': 'iptal_et',
    'Neuen Super Admin hinzufügen': 'yeni_super_admin_ekle',
    'Wenn die E-Mail bereits registriert ist, wird der Benutzer sofort zum Super Admin befördert. Sonst wird ein Einladungslink erstellt (72 Std. gültig).': 'davet_aciklama',
    'E-Mail-Adresse': 'eposta_adresi',
    'Lädt...': 'yukleniyor',
    'Hinzufügen': 'ekle',
    'Benutzer wurde zum Super Admin befördert.': 'kullanici_super_admin_yapildi',
    'Einladungslink erstellt:': 'davet_linki_olusturuldu'
};

for (const [de, key] of Object.entries(translations)) {
    if (de === 'Foto<br/>hinzufügen' || de === 'Wenn die E-Mail bereits registriert ist, wird der Benutzer sofort zum Super Admin befördert. Sonst wird ein Einladungslink erstellt (72 Std. gültig).') {
        const regexJsx = new RegExp(`>\\s*${de.replace(/<br\/>/g, '<br\\s*\\/?>').replace(/\./g, '\\.')}\\s*<`, 'g');
        content = content.replace(regexJsx, ` dangerouslySetInnerHTML={{ __html: t('${key}') }}<`);
    } else {
        const regexJsx = new RegExp(`>\\s*${de.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/\//g, '\\/').replace(/\+/g, '\\+').replace(/\./g, '\\.')}\\s*<`, 'g');
        content = content.replace(regexJsx, `>{t('${key}')}<`);
        
        const regexAttr = new RegExp(`placeholder="${de}"`, 'g');
        content = content.replace(regexAttr, `placeholder={t('${key}')}`);
        
        const regexTernary = new RegExp(`'${de}'`, 'g');
        content = content.replace(regexTernary, `t('${key}')`);
    }
}

// Ensure the HTML replaces are correct
content = content.replace(/> dangerouslySetInnerHTML={{ __html: t\('foto_ekle'\) }}</g, ` dangerouslySetInnerHTML={{ __html: t('foto_ekle') }}>`);
content = content.replace(/<p className="text-xs text-gray-500 mb-4" dangerouslySetInnerHTML={{ __html: t\('davet_aciklama'\) }}</g, `<p className="text-xs text-gray-500 mb-4" dangerouslySetInnerHTML={{ __html: t('davet_aciklama') }}></p>`);

// Also fix the edit button inner text "Bearbeiten"
content = content.replace(/>\s*Bearbeiten\s*</g, `>{t('duzenle')}<`);

fs.writeFileSync(filePath, content, 'utf8');

const dictionaries = {
    tr: {
        super_admins_title: 'Süper Adminler',
        plattform_adminleri_yonet: 'Platform Yöneticilerini Yönetin',
        aktif_super_adminler: 'Aktif Süper Adminler',
        super_admin_bulunamadi: 'Süper Admin bulunamadı',
        profili_duzenle: 'Profili Düzenle',
        foto_ekle: 'Fotoğraf<br/>Ekle',
        fotografi_degistir: 'Fotoğrafı Değiştir',
        isim: 'İsim',
        unvan_pozisyon: 'Ünvan / Pozisyon',
        biyografi: 'Biyografi',
        kaydediliyor: 'Kaydediliyor...',
        kaydet: 'Kaydet',
        iptal_et: 'İptal Et',
        yeni_super_admin_ekle: 'Yeni Süper Admin Ekle',
        davet_aciklama: 'E-posta zaten kayıtlıysa kullanıcı süper admin yapılır. Aksi takdirde bir davet linki oluşturulur (72 saat geçerli).',
        eposta_adresi: 'E-posta Adresi',
        yukleniyor: 'Yükleniyor...',
        ekle: 'Ekle',
        kullanici_super_admin_yapildi: 'Kullanıcı süper admin yapıldı.',
        davet_linki_olusturuldu: 'Davet linki oluşturuldu:',
        duzenle: 'Düzenle'
    },
    de: {
        super_admins_title: 'Super Admins',
        plattform_adminleri_yonet: 'Plattform-Administratoren verwalten',
        aktif_super_adminler: 'Aktive Super Admins',
        super_admin_bulunamadi: 'Keine Super Admins gefunden',
        profili_duzenle: 'Profil bearbeiten',
        foto_ekle: 'Foto<br/>hinzufügen',
        fotografi_degistir: 'Foto ändern',
        isim: 'Name',
        unvan_pozisyon: 'Titel / Position',
        biyografi: 'Bio',
        kaydediliyor: 'Speichern...',
        kaydet: 'Speichern',
        iptal_et: 'Abbrechen',
        yeni_super_admin_ekle: 'Neuen Super Admin hinzufügen',
        davet_aciklama: 'Wenn die E-Mail bereits registriert ist, wird der Benutzer sofort zum Super Admin befördert. Sonst wird ein Einladungslink erstellt (72 Std. gültig).',
        eposta_adresi: 'E-Mail-Adresse',
        yukleniyor: 'Lädt...',
        ekle: 'Hinzufügen',
        kullanici_super_admin_yapildi: 'Benutzer wurde zum Super Admin befördert.',
        davet_linki_olusturuldu: 'Einladungslink erstellt:',
        duzenle: 'Bearbeiten'
    },
    en: {
        super_admins_title: 'Super Admins',
        plattform_adminleri_yonet: 'Manage Platform Administrators',
        aktif_super_adminler: 'Active Super Admins',
        super_admin_bulunamadi: 'No Super Admins found',
        profili_duzenle: 'Edit Profile',
        foto_ekle: 'Add<br/>Photo',
        fotografi_degistir: 'Change Photo',
        isim: 'Name',
        unvan_pozisyon: 'Title / Position',
        biyografi: 'Bio',
        kaydediliyor: 'Saving...',
        kaydet: 'Save',
        iptal_et: 'Cancel',
        yeni_super_admin_ekle: 'Add New Super Admin',
        davet_aciklama: 'If the email is already registered, the user is immediately promoted to Super Admin. Otherwise, an invitation link is created (valid for 72 hrs).',
        eposta_adresi: 'Email Address',
        yukleniyor: 'Loading...',
        ekle: 'Add',
        kullanici_super_admin_yapildi: 'User has been promoted to Super Admin.',
        davet_linki_olusturuldu: 'Invitation link created:',
        duzenle: 'Edit'
    },
    nl: {
        super_admins_title: 'Super Admins',
        plattform_adminleri_yonet: 'Beheer Platformbeheerders',
        aktif_super_adminler: 'Actieve Super Admins',
        super_admin_bulunamadi: 'Geen Super Admins gevonden',
        profili_duzenle: 'Profiel bewerken',
        foto_ekle: 'Foto<br/>toevoegen',
        fotografi_degistir: 'Foto wijzigen',
        isim: 'Naam',
        unvan_pozisyon: 'Functie / Positie',
        biyografi: 'Bio',
        kaydediliyor: 'Opslaan...',
        kaydet: 'Opslaan',
        iptal_et: 'Annuleren',
        yeni_super_admin_ekle: 'Nieuwe Super Admin Toevoegen',
        davet_aciklama: 'Als de e-mail al geregistreerd is, wordt de gebruiker direct bevorderd tot Super Admin. Anders wordt er een uitnodigingslink aangemaakt (72 uur geldig).',
        eposta_adresi: 'E-mailadres',
        yukleniyor: 'Laden...',
        ekle: 'Toevoegen',
        kullanici_super_admin_yapildi: 'Gebruiker is bevorderd tot Super Admin.',
        davet_linki_olusturuldu: 'Uitnodigingslink aangemaakt:',
        duzenle: 'Bewerken'
    }
};

const locales = ['tr', 'de', 'en', 'nl'];
for (const loc of locales) {
    const jsonPath = path.join(__dirname, `messages/${loc}.json`);
    const jsonStr = fs.readFileSync(jsonPath, 'utf8');
    const db = JSON.parse(jsonStr);
    
    if (!db.SuperAdmins) {
        db.SuperAdmins = {};
    }
    Object.assign(db.SuperAdmins, dictionaries[loc]);

    fs.writeFileSync(jsonPath, JSON.stringify(db, null, 2), 'utf8');
}

console.log('Fixed superadmins/page.tsx');
