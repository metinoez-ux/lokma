const fs = require('fs');
const path = require('path');

const ameisePagePath = path.join(__dirname, 'src/app/[locale]/admin/ameise/page.tsx');
let content = fs.readFileSync(ameisePagePath, 'utf8');

if (!content.includes('useTranslations(')) {
    content = content.replace("import { auth } from '@/lib/firebase';", "import { auth } from '@/lib/firebase';\nimport { useTranslations } from 'next-intl';");
    content = content.replace('export default function AmeisePage() {\n    const { admin, loading } = useAdmin();', "export default function AmeisePage() {\n    const { admin, loading } = useAdmin();\n    const t = useTranslations('Ameise');");
}

const map = {
    'Ameise': 'ameise_title',
    'Datenimport, Export und Bereinigung': 'datenimport_export_und_bereinigung',
    'Betriebe Export / Import': 'betriebe_export_import',
    'Betrieb Import': 'betrieb_import',
    'Test Verilerini Temizle': 'test_verilerini_temizle',
    'Login-Konten (E-Mail, Telefon, Google)': 'login_konten_email_telefon_google',
    'Firestore user-Dokumente + Benachrichtigungen': 'firestore_user_dokumente_benachrichtigun',
    'Nicht-Super-Admin Konten': 'nicht_super_admin_konten',
    'Alle Bestellungen, Warenkorbe, Liefernachweise': 'alle_bestellungen_warenkorbe_liefernachw',
    'Bewertungen + Geschaftsstatistiken zurucksetzen': 'bewertungen_geschaftsstatistiken_zuruckse',
    'Provisionen, Gutscheine, Sponsoring, Nutzungsdaten': 'provisionen_gutscheine_sponsoring_nutzu',
    'Geplante Push-Benachrichtigungen': 'geplante_push_benachrichtigungen',
    'Referral / Empfehlungscodes': 'referral_empfehlungscodes',
    'Tischreservierungen': 'tischreservierungen',
    'Admin-Aktivitatslogdaten': 'admin_aktivitatslogdaten',
    'Produkt-/Betriebsmeldungen': 'produkt_betriebsmeldungen',
    'Registrierte Betriebe + Menüs + Produkte': 'registrierte_betriebe_menus_produkte',
    'Personal-Schichten (İş Saatleri)': 'personal_schichten_is_saatleri',
    'Exportiere...': 'exportiere',
    'JSON Export': 'json_export',
    'JSON Import': 'json_import',
    'Import-Vorschau': 'import_vorschau',
    'Abbrechen': 'abbrechen',
    'Schliessen': 'schliessen',
    'Suchen': 'suchen'
};

for (const [de, key] of Object.entries(map)) {
    // Replace in JSX >Text< format
    const regexJsx = new RegExp(`>\\s*${de.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/\//g, '\\/').replace(/\+/g, '\\+')}\\s*<`, 'g');
    content = content.replace(regexJsx, `>{t('${key}')}<`);

    // Only literal string replacements where it's isolated (like placeholders or labels)
}

fs.writeFileSync(ameisePagePath, content, 'utf8');
console.log('Fixed ameise/page.tsx');
