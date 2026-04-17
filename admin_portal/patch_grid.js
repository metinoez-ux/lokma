const fs = require('fs');
const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/kermes/[id]/KermesRosterTab.tsx';
let txt = fs.readFileSync(file, 'utf8');

// Replace top level grid container
txt = txt.replace('className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end"', 'className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_2fr_1fr_auto] gap-4 items-end"');

// Replace first space-y-1 (personel) and second (gorev)
// Actually wait! I can just replace the form block using a robust regex.
const regex = /<form onSubmit=\{handleCreate\} className="grid grid-cols-[^"]+">([\s\S]*?)<\/form>/;
// I'll just do a search and replace for the precise strings.

txt = txt.replace('className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 xl:grid-cols-6 gap-4 items-end"', 'className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 items-end"');

const blockOld = `<form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-xs text-muted-foreground">Personel Seç</label>`;

const blockNew = `<form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_2.5fr_1fr_max-content] gap-3 items-end">
          <div className="w-full space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-xs text-muted-foreground">Personel Seç</label>`;

txt = txt.replace(blockOld, blockNew);

const gorevOld = `</select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Görev / Rol</label>`;

const gorevNew = `</select>
          </div>
          <div className="w-full space-y-1">
            <label className="text-xs text-muted-foreground">Görev / Rol</label>`;

txt = txt.replace(gorevOld, gorevNew);

const tarihOld = `</select>
          </div>
          <div className="col-span-1 sm:col-span-2 lg:col-span-2 space-y-1">
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs text-muted-foreground">Tarih Aralığı (Başlangıç - Bitiş)</label>`;

const tarihNew = `</select>
          </div>
          <div className="col-span-1 sm:col-span-2 xl:col-span-1 w-full space-y-1">
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs text-muted-foreground">Tarih Aralığı (Başlangıç - Bitiş)</label>`;

txt = txt.replace(tarihOld, tarihNew);

const saatOld = `</div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Saat (Başlangıç - Bitiş)</label>`;

const saatNew = `</div>
          </div>
          <div className="w-full space-y-1">
            <label className="text-xs text-muted-foreground">Saat (Başlangıç - Bitiş)</label>`;

txt = txt.replace(saatOld, saatNew);

const btnOld = `</div>
          </div>
          <div>
            <button 
              type="submit"`;

const btnNew = `</div>
          </div>
          <div className="shrink-0 w-full xl:w-24">
            <button 
              type="submit"`;

txt = txt.replace(btnOld, btnNew);

fs.writeFileSync(file, txt);
