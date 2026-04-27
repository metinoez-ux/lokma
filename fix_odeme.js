const fs = require('fs');
const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/business/[id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const anchor = ` {/* ═══════ Tab 5: Açılış Saatleri (Genel / Kurye / Gel-Al) ═══════ */}`;

const odemeUI = `
  {/* ═══════ Tab 6: Ödeme & Banka Bilgileri ═══════ */}
  {settingsSubTab === "isletme" && isletmeInternalTab === "odeme" && (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* LOKMA Payout Bank Account */}
        <div className="bg-card rounded-xl p-5 border border-border shadow-sm">
          <h4 className="text-foreground font-bold mb-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">L</div>
            LOKMA Ödeme Bilgileri
          </h4>
          <p className="text-xs text-muted-foreground mb-4">LOKMA'dan işletmeye yapılacak hakediş ödemeleri için banka hesabı.</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Hesap Sahibi (Firma / Kişi Adı)</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.payoutBankAccountHolder || ""}
                  onChange={(e) => setFormData({ ...formData, payoutBankAccountHolder: e.target.value })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary outline-none"
                  placeholder="Hesap Sahibi"
                />
              ) : (
                <p className="text-foreground font-medium bg-muted/30 px-4 py-2 rounded-lg border border-transparent min-h-[40px]">{formData.payoutBankAccountHolder || "-"}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">IBAN</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.payoutBankIban || ""}
                  onChange={(e) => setFormData({ ...formData, payoutBankIban: e.target.value })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary outline-none"
                  placeholder="DE..."
                />
              ) : (
                <p className="text-foreground font-medium bg-muted/30 px-4 py-2 rounded-lg border border-transparent font-mono min-h-[40px]">{formData.payoutBankIban || "-"}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Banka Adı</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.payoutBankName || ""}
                  onChange={(e) => setFormData({ ...formData, payoutBankName: e.target.value })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary outline-none"
                  placeholder="Banka Adı"
                />
              ) : (
                <p className="text-foreground font-medium bg-muted/30 px-4 py-2 rounded-lg border border-transparent min-h-[40px]">{formData.payoutBankName || "-"}</p>
              )}
            </div>
          </div>
        </div>

        {/* POS Provider Bank Account */}
        <div className="bg-card rounded-xl p-5 border border-border shadow-sm">
          <h4 className="text-foreground font-bold mb-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center"><CreditCard className="w-4 h-4"/></div>
            POS Banka Bilgileri
          </h4>
          <p className="text-xs text-muted-foreground mb-4">Kartlı ödeme (POS) sağlayıcısından gelecek ödemeler için banka hesabı.</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Hesap Sahibi (Firma / Kişi Adı)</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.bankAccountHolder || ""}
                  onChange={(e) => setFormData({ ...formData, bankAccountHolder: e.target.value })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary outline-none"
                  placeholder="Hesap Sahibi"
                />
              ) : (
                <p className="text-foreground font-medium bg-muted/30 px-4 py-2 rounded-lg border border-transparent min-h-[40px]">{formData.bankAccountHolder || "-"}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">IBAN</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.bankIban || ""}
                  onChange={(e) => setFormData({ ...formData, bankIban: e.target.value })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary outline-none"
                  placeholder="DE..."
                />
              ) : (
                <p className="text-foreground font-medium bg-muted/30 px-4 py-2 rounded-lg border border-transparent font-mono min-h-[40px]">{formData.bankIban || "-"}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Banka Adı</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.bankName || ""}
                  onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary outline-none"
                  placeholder="Banka Adı"
                />
              ) : (
                <p className="text-foreground font-medium bg-muted/30 px-4 py-2 rounded-lg border border-transparent min-h-[40px]">{formData.bankName || "-"}</p>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  )}

`;

if (content.includes(anchor) && !content.includes("Tab 6: Ödeme & Banka Bilgileri")) {
  content = content.replace(anchor, odemeUI + anchor);
  fs.writeFileSync(file, content, 'utf8');
  console.log("Success: Inserted Bank Form successfully.");
} else if (content.includes("Tab 6: Ödeme & Banka Bilgileri")) {
  console.log("Info: Bank Form already exists!");
} else {
  console.error("Error: Anchor not found!");
}
