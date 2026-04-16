import fs from 'fs';

const FILE_PATH = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/kermes-tv/[kermesId]/page.tsx';
let content = fs.readFileSync(FILE_PATH, 'utf-8');

const i18nDictStr = `
const I18N_DICT: any = {
  de: {
    preparing: 'Wird zubereitet',
    ready: 'Abholbereit',
    emptyPreparing: 'Keine zubereitenden Bestellungen',
    emptyReady: 'Keine fertigen Bestellungen',
    activeOrder: 'Aktive Bestellung(en)',
    footerMessage: 'Wenn Ihre Nummer auf dem Bildschirm erscheint, können Sie diese an der Theke abholen',
    readyLabel: 'Abholbereit',
    dayStr: (day: number) => \`Tag \${day}\`,
    allSections: 'Alle Abteilungen'
  },
  nl: {
    preparing: 'In bereiding',
    ready: 'Klaar',
    emptyPreparing: 'Geen bestellingen',
    emptyReady: 'Geen bestellingen klaar',
    activeOrder: 'actieve bestelling(en)',
    footerMessage: 'Wanneer uw nummer op het scherm verschijnt, kunt u het ophalen aan de balie',
    readyLabel: 'Klaar',
    dayStr: (day: number) => \`Dag \${day}\`,
    allSections: 'Alle Afdelingen'
  },
  tr: {
    preparing: 'Hazırlanıyor',
    ready: 'Hazır',
    emptyPreparing: 'Hazırlanan sipariş yok',
    emptyReady: 'Hazır sipariş yok',
    activeOrder: 'aktif sipariş',
    footerMessage: 'Numaranız ekranda göründüğünde tezgahtan alabilirsiniz',
    readyLabel: 'Teslim Alınabilir',
    dayStr: (day: number) => \`\${day}. Gün\`,
    allSections: 'Tüm Bölümler'
  }
};

function getDualLang(key: string, lang2: string | null, ...args: any[]) {
   const trStr = typeof I18N_DICT.tr[key] === 'function' ? I18N_DICT.tr[key](...args) : I18N_DICT.tr[key];
   if (!lang2 || !I18N_DICT[lang2]) return trStr;
   const secStr = typeof I18N_DICT[lang2][key] === 'function' ? I18N_DICT[lang2][key](...args) : I18N_DICT[lang2][key];
   return \`\${trStr} / \${secStr}\`;
}
`;

// Insert I18N_DICT right after getWeatherIcon function
content = content.replace(/(function getWeatherIcon\([^)]*\)\s*{[^}]*})/m, '$1\n' + i18nDictStr);

// Add state variables
content = content.replace(/const \[currentTime, setCurrentTime\] = useState\(new Date\(\)\);/m, 
  "const [currentTime, setCurrentTime] = useState(new Date());\n  const [lang2, setLang2] = useState<string | null>(null);\n  const [dateRangeStr, setDateRangeStr] = useState<string>('');\n  const [currentDay, setCurrentDay] = useState<number | null>(null);");

// Update fetchKermesMeta
const metaLogicCode = `
          // Dil belirleme
          const countryStr = (data.country || '').toLowerCase();
          if (countryStr.includes('germany') || countryStr.includes('almanya') || countryStr.includes('deutschland') || countryStr.includes('austria') || countryStr.includes('avusturya') || countryStr.includes('österreich') || countryStr.includes('switzer') || countryStr.includes('isvicre') || countryStr.includes('schweiz')) {
            setLang2('de');
          } else if (countryStr.includes('nether') || countryStr.includes('hollanda') || countryStr.includes('niederlande')) {
            setLang2('nl');
          }

          // Tarih ve Gün hesaplama
          const sD = data.date?.toDate?.() || data.startDate?.toDate?.() || null;
          const eD = data.endDate?.toDate?.() || null;
          
          if (sD) {
             const startDate = new Date(sD);
             let dateStr = \`\${startDate.getDate().toString().padStart(2, '0')}\`;
             
             if (eD) {
                const endDate = new Date(eD);
                if (startDate.getMonth() === endDate.getMonth()) {
                   dateStr += \`-\${endDate.getDate().toString().padStart(2, '0')}.\${(startDate.getMonth() + 1).toString().padStart(2, '0')}.\${startDate.getFullYear()}\`;
                } else {
                   dateStr += \`.\${(startDate.getMonth() + 1).toString().padStart(2, '0')} - \${endDate.getDate().toString().padStart(2, '0')}.\${(endDate.getMonth() + 1).toString().padStart(2, '0')}.\${startDate.getFullYear()}\`;
                }
             } else {
                dateStr += \`.\${(startDate.getMonth() + 1).toString().padStart(2, '0')}.\${startDate.getFullYear()}\`;
             }
             setDateRangeStr(dateStr);

             const now = new Date();
             now.setHours(0,0,0,0);
             const st = new Date(startDate);
             st.setHours(0,0,0,0);
             const diff = Math.floor((now.getTime() - st.getTime()) / (1000 * 60 * 60 * 24));
             
             if (eD) {
                const en = new Date(eD);
                en.setHours(0,0,0,0);
                if (now.getTime() > en.getTime()) {
                   setCurrentDay(-1); // Bitti
                } else {
                   setCurrentDay(diff >= 0 ? diff + 1 : 0);
                }
             } else {
                setCurrentDay(diff >= 0 ? diff + 1 : 0);
             }
          }
`;

content = content.replace(/setKermesName\(data\.name \|\| data\.title \|\| 'Kermes'\);/, "setKermesName(data.name || data.title || 'Kermes');\n" + metaLogicCode);

// UI Replacements
// KermesName display
content = content.replace(
  /<span style={{ fontSize: '22px', fontWeight: 500, color: '#64748b' }}>\{kermesName\}<\/span>/,
  `
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '22px', fontWeight: 500, color: '#64748b' }}>{kermesName}</span>
                {dateRangeStr && <span style={{ fontSize: '18px', color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '6px' }}>{dateRangeStr}</span>}
                {currentDay !== null && currentDay > 0 && (
                  <span style={{ fontSize: '16px', fontWeight: 600, color: '#fbbf24', marginLeft: '4px' }}>
                    • {getDualLang('dayStr', lang2, currentDay)}
                  </span>
                )}
              </div>`
);

// Title displayTitle -> Tum bolumler replacing
content = content.replace(/const displayTitle = sectionLabel \|\| 'Tum Bolumler';/, "const displayTitle = sectionLabel || getDualLang('allSections', lang2);");

// OrderCount
content = content.replace(/\{totalActive\} aktif siparis/, "{totalActive} {getDualLang('activeOrder', lang2)}");

// Preparing Header
content = content.replace(/<h2 className=\{styles\.panelTitlePreparing\}>Hazirlaniyor<\/h2>/, "<h2 className={styles.panelTitlePreparing}>{getDualLang('preparing', lang2)}</h2>");
content = content.replace(/<p className=\{styles\.emptyText\}>Hazirlanan siparis yok<\/p>/, "<p className={styles.emptyText}>{getDualLang('emptyPreparing', lang2)}</p>");

// Ready Header
content = content.replace(/<h2 className=\{styles\.panelTitleReady\}>Hazir<\/h2>/, "<h2 className={styles.panelTitleReady}>{getDualLang('ready', lang2)}</h2>");
content = content.replace(/<p className=\{styles\.emptyText\}>Hazir siparis yok<\/p>/, "<p className={styles.emptyText}>{getDualLang('emptyReady', lang2)}</p>");
content = content.replace(/<span className=\{styles\.readyLabel\}>Teslim Alinabilir<\/span>/, "<span className={styles.readyLabel}>{getDualLang('readyLabel', lang2)}</span>");

// Footer
content = content.replace(/Numaraniz ekranda gorundugunde tezgahtan alabilirsiniz/, "{getDualLang('footerMessage', lang2)}");

fs.writeFileSync(FILE_PATH, content, 'utf-8');
console.log('done updating tv-page');
