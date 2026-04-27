const fs = require('fs');
const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/business/[id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add state
if (!content.includes('const [personelInternalTab, setPersonelInternalTab]')) {
  content = content.replace(
    'const [isletmeInternalTab, setIsletmeInternalTab] = useState<"bilgiler"',
    'const [personelInternalTab, setPersonelInternalTab] = useState<"list" | "vardiya">("list");\n  const [isletmeInternalTab, setIsletmeInternalTab] = useState<"bilgiler"'
  );
}

// 2. Replace Header and Add Tabs
const headerSearch = `<h2 className="text-xl font-bold text-foreground">{t('personelYonetimi') || 'Personalverwaltung'}</h2>`;
const headerReplace = `<div className="flex gap-2">
      <button
        onClick={() => setPersonelInternalTab('list')}
        className={\`px-4 py-2 rounded-lg text-sm font-medium transition \${personelInternalTab === 'list' ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-foreground hover:bg-muted'}\`}
      >
        {t('personel_mevcut') || 'Personel Listesi'}
      </button>
      <button
        onClick={() => setPersonelInternalTab('vardiya')}
        className={\`px-4 py-2 rounded-lg text-sm font-medium transition \${personelInternalTab === 'vardiya' ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-foreground hover:bg-muted'}\`}
      >
        {!planFeatures.staffShiftTracking && admin?.adminType !== 'super' && '🔒 '}
        {t('kurye_vardiya') || 'Vardiya Takibi'}
      </button>
    </div>`;

if (content.includes(headerSearch)) {
  content = content.replace(headerSearch, headerReplace);
}

// 3. Wrap Overage Banner and List in {personelInternalTab === 'list' && ( ... )}
const listStartSearch = `{/* Overage / Quota Warning Banner */}
  {(() => {`;
const listStartReplace = `{/* Overage / Quota Warning Banner */}
  {personelInternalTab === 'list' && (() => {`;
if (content.includes(listStartSearch)) {
  content = content.replace(listStartSearch, listStartReplace);
}

// 4. Wrap Vardiya block in {personelInternalTab === 'vardiya' && ( ... )}
const vardiyaStartSearch = `{/* ═══════ Aktif Vardiyalar Panel ═══════ */}
  <LockedModuleOverlay featureKey="staffShiftTracking">`;
const vardiyaStartReplace = `{/* ═══════ Aktif Vardiyalar Panel ═══════ */}
  {personelInternalTab === 'vardiya' && (
  <LockedModuleOverlay featureKey="staffShiftTracking">`;
if (content.includes(vardiyaStartSearch)) {
  content = content.replace(vardiyaStartSearch, vardiyaStartReplace);
}

// 5. Close Vardiya block and Open List block again
const vardiyaEndSearch = `  </LockedModuleOverlay>

  {/* Aktif / Arşivlenmiş Tabs */}`;
const vardiyaEndReplace = `  </LockedModuleOverlay>
  )}

  {personelInternalTab === 'list' && (
  <>
  {/* Aktif / Arşivlenmiş Tabs */}`;
if (content.includes(vardiyaEndSearch)) {
  content = content.replace(vardiyaEndSearch, vardiyaEndReplace);
}

// 6. Close the List block at the end of Personel section
const listEndSearch = `  </div>
  </div>

  {/* ══ INVITE MODAL ══ */}`;
const listEndReplace = `  </div>
  </>
  )}
  </div>

  {/* ══ INVITE MODAL ══ */}`;
if (content.includes(listEndSearch)) {
  content = content.replace(listEndSearch, listEndReplace);
}

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed syntax correctly.');
