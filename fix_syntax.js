const fs = require('fs');
const path = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/business/[id]/page.tsx';

let content = fs.readFileSync(path, 'utf8');

// The block that currently ends Vardiya Takibi is at 6942
const target1 = `  </div>
  )}
  </LockedModuleOverlay>

  {/* Aktif / Arşivlenmiş Tabs */}`;

const replace1 = `  </div>
  )}
  </LockedModuleOverlay>
  )}

  {personelInternalTab === 'list' && (
  <>
  {/* Aktif / Arşivlenmiş Tabs */}`;

if (content.includes(target1)) {
  content = content.replace(target1, replace1);
  console.log("Replaced target1");
} else {
  console.log("target1 not found. Make sure the exact whitespace matches.");
}

const target2 = `  </div>
  </div>

  {/* ══ INVITE MODAL ══ */}`;

const replace2 = `  </div>
  </>
  )}
  </div>

  {/* ══ INVITE MODAL ══ */}`;

if (content.includes(target2)) {
  content = content.replace(target2, replace2);
  console.log("Replaced target2");
} else {
  console.log("target2 not found.");
}

fs.writeFileSync(path, content, 'utf8');
console.log("Done");
