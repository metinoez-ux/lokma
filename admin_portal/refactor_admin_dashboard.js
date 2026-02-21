const fs = require('fs');

const targetFile = 'src/app/[locale]/admin/dashboard/page.tsx';
let content = fs.readFileSync(targetFile, 'utf8');

// Add useTranslations ('AdminDashboard') to the component
if (!content.includes('useTranslations(')) {
    content = content.replace("import { useAdmin } from '@/components/providers/AdminProvider';", "import { useAdmin } from '@/components/providers/AdminProvider';\nimport { useTranslations } from 'next-intl';");
    content = content.replace("export default function SuperAdminDashboard() {", "export default function SuperAdminDashboard() {\n    const t = useTranslations('AdminDashboard');");
    content = content.replace("const handleLogout = async () =>", "const tNav = useTranslations('AdminNav');\n    const handleLogout = async () =>");
}

const replacements = {
    "'Admin listesi yüklenirken hata oluştu'": "t('errorLoadingAdmins')",
    "'Konum alınamadı. Lütfen GPS izni verin.'": "t('locationFailed')",
    "'GPS verisi bulunamadı.'": "t('noGpsData')",
    "'Adres çözümlenemedi. Lütfen manuel olarak girin.'": "t('addressResolutionFailed')",
    "'Adres çözümlenemedi. Google Maps yüklenemedi.'": "t('addressResolutionMapsFailed')",
    "Tüm Kullanıcılar": "{t('allUsers')}",
    "İşletme Adminleri": "{t('businessAdmins')}",
    "Sub Adminler (Personel)": "{t('subAdmins')}",
    "Super Adminler": "{t('superAdmins')}",
    "Kullanıcı bulunamadı": "{t('noUsersFound')}",
    "Admin bulunamadı": "{t('noAdminsFound')}",
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
    "Hesabım": "{tNav('myAccount')}",
    "Çıkış Yap": "{tNav('logout')}",
    "'İsimsiz'": "t('unnamed')",
    "'Profil'": "t('profile')",
    "'İşletme'": "t('businessLabel')",
    ">İşletme<": ">{t('businessLabel')}<",
    ">İşletmeler<": ">{tNav('businesses')}<",
    ">Siparişler<": ">{tNav('orders')}<",
    ">Müşteriler<": ">{tNav('customers')}<",
    ">Ürünler<": ">{tNav('productsCategories')}<",
    "Daha Fazla Yükle": "{t('loadMore')}",
    "Kullanıcılar yükleniyor...": "{t('loadingUsers')}",
    "Sonuç bulunamadı": "{t('noResultsFound')}",
    "İsim, soyisim, e-posta, telefon veya işletme adı ile ara...": "{t('searchPlaceholder')}",
    "'Silme hatası'": "t('deleteError')",
    "Kullanıcı silindi": "{t('userDeleted')}",
    "'Bir hata oluştu'": "t('generalError')",
    "'Hata oluştu'": "t('generalError')",
    "'Lütfen zorunlu alanları doldurun'": "t('pleaseFillRequired')",
    "'Silme sırasında hata oluştu'": "t('deleteErrorDuring')",
    "'Kullanıcılar yüklenirken hata oluştu'": "t('errorLoadingUsers')",
    "Kullanıcıyı Arşivle": "{t('archiveUser')}",
    "Kullanıcıyı Aktifleştir": "{t('activateUser')}",
    "Admini Kalıcı Sil": "{t('deleteAdminPerm')}"
};

for (const [key, value] of Object.entries(replacements)) {
    content = content.replaceAll(key, value);
}

fs.writeFileSync(targetFile, content, 'utf8');

// Update TR JSON
const trJsonPath = 'messages/tr.json';
const trJson = JSON.parse(fs.readFileSync(trJsonPath, 'utf8'));

trJson.AdminDashboard = {
    "errorLoadingAdmins": "Admin listesi yüklenirken hata oluştu",
    "locationFailed": "Konum alınamadı. Lütfen GPS izni verin.",
    "noGpsData": "GPS verisi bulunamadı.",
    "addressResolutionFailed": "Adres çözümlenemedi. Lütfen manuel olarak girin.",
    "addressResolutionMapsFailed": "Adres çözümlenemedi. Google Maps yüklenemedi.",
    "allUsers": "Tüm Kullanıcılar",
    "businessAdmins": "İşletme Adminleri",
    "subAdmins": "Sub Adminler (Personel)",
    "superAdmins": "Super Adminler",
    "noUsersFound": "Kullanıcı bulunamadı",
    "noAdminsFound": "Admin bulunamadı",
    "loading": "Yükleniyor...",
    "pendingInvitations": "Onay Bekleyen Davetiyeler",
    "noPendingInvitations": "Bekleyen davetiye yok",
    "registrationComplete": "Kayıt Tamamlandı",
    "waitingForLink": "Link Bekleniyor",
    "roleLabel": "Rol",
    "businessLabel": "İşletme",
    "invitedByLabel": "Davet Eden",
    "dateLabel": "Tarih",
    "approve": "Onayla",
    "reject": "Reddet",
    "close": "Kapat",
    "unnamed": "İsimsiz",
    "profile": "Profil",
    "loadMore": "Daha Fazla Yükle",
    "loadingUsers": "Kullanıcılar yükleniyor...",
    "noResultsFound": "Sonuç bulunamadı",
    "searchPlaceholder": "İsim, soyisim, e-posta, telefon veya işletme adı ile ara...",
    "deleteError": "Silme hatası",
    "userDeleted": "Kullanıcı silindi",
    "generalError": "Bir hata oluştu",
    "pleaseFillRequired": "Lütfen zorunlu alanları doldurun",
    "deleteErrorDuring": "Silme sırasında hata oluştu",
    "errorLoadingUsers": "Kullanıcılar yüklenirken hata oluştu",
    "archiveUser": "Kullanıcıyı Arşivle",
    "activateUser": "Kullanıcıyı Aktifleştir",
    "deleteAdminPerm": "Admini Kalıcı Sil"
};

fs.writeFileSync(trJsonPath, JSON.stringify(trJson, null, 2), 'utf8');
console.log('Dashboard refactored partially.');
