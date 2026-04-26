const fs = require('fs');
const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/account/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace imports
if (!content.includes('BusinessInvoiceSection')) {
  content = content.replace(
    "import { BUSINESS_TYPES } from '@/lib/business-types';",
    "import { BUSINESS_TYPES } from '@/lib/business-types';\nimport BusinessInvoiceSection from '@/components/invoices/BusinessInvoiceSection';"
  );
}

// Just find the index of "SON FATURALAR" and "BANKA BİLGİSİ MODAL"
const startIdx = content.indexOf('SON FATURALAR');
const endIdx = content.indexOf('BANKA BİLGİSİ MODAL');

if (startIdx !== -1 && endIdx !== -1) {
  // Find the exact ` {/* ════════` before SON FATURALAR
  const actualStart = content.lastIndexOf('{/* ════════', startIdx);
  // Find the exact ` {/* ════════` before BANKA BİLGİSİ
  const actualEnd = content.lastIndexOf('{/* ════════', endIdx);
  
  const toReplace = content.substring(actualStart, actualEnd);
  
  const replaceStr = `{/* ═══════════════════════════════════════════════════════════════════
        FATURALAR
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="bg-gradient-to-br from-card/80 to-card border border-border/40 rounded-xl p-6 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">{tAccount('aylik_fatura_gecmisi') || 'Faturalar & Ödemeler'}</h3>
          </div>

          <BusinessInvoiceSection invoices={invoices} />
        </div>
          </div>
        )}
      </div>

      `;
      
  content = content.replace(toReplace, replaceStr);
  fs.writeFileSync(file, content);
  console.log('Replaced successfully');
} else {
  console.log('Marker not found');
}
