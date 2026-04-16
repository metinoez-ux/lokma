const fs = require('fs');
const p = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/components/TableManagementPanel.tsx';
let d = fs.readFileSync(p, 'utf8');

// 1. Add state
if (!d.includes('const [editingSection')) {
    d = d.replace(/const \[activeForm, setActiveForm\] = useState<\n    'single' \| 'bulk' \| 'generate' \| null\n  >\(null\);/, 
    "const [activeForm, setActiveForm] = useState<'single' | 'bulk' | 'generate' | null>(null);\n  const [editingSection, setEditingSection] = useState<{oldName: string, newName: string} | null>(null);");
}

// 2. Add handleRenameSection
if (!d.includes('const handleRenameSection')) {
    const renameLogic = `
  const handleRenameSection = (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName || tableSections.includes(trimmed)) {
       setEditingSection(null);
       return;
    }
    const newSections = tableSections.map(s => s === oldName ? trimmed : s);
    const newTables = tables.map(t => t.section === oldName ? { ...t, section: trimmed } : t);
    const newDefs = sectionDefs.map(d => d.name === oldName ? { ...d, name: trimmed } : d);
    updateAndSave(newTables, undefined, undefined, newSections, newDefs, undefined);
    setEditingSection(null);
  };
`;
    // Insert before "const addSingleTable"
    d = d.replace(/  \/\/ Tek masa ekle/, renameLogic + '\n  // Tek masa ekle');
}

// 3. Update the render
const originalSpan = `<span className="text-white font-semibold">{section}</span>`;
const editableSpan = `
                    {editingSection?.oldName === section ? (
                      <div className="flex items-center gap-1">
                        <input
                           autoFocus
                           className="text-black px-2 py-0.5 rounded text-sm font-semibold w-40 outline-none"
                           value={editingSection.newName}
                           onChange={(e) => setEditingSection({...editingSection, newName: e.target.value})}
                           onKeyDown={(e) => {
                             if (e.key === 'Enter') handleRenameSection(section, editingSection.newName);
                             if (e.key === 'Escape') setEditingSection(null);
                           }}
                        />
                        <button className="bg-green-600 hover:bg-green-500 text-white rounded p-1 flex items-center justify-center shadow-sm" onClick={() => handleRenameSection(section, editingSection.newName)}><span className="material-symbols-outlined text-[14px]">check</span></button>
                        <button className="bg-red-600 hover:bg-red-500 text-white rounded p-1 flex items-center justify-center shadow-sm" onClick={() => setEditingSection(null)}><span className="material-symbols-outlined text-[14px]">close</span></button>
                      </div>
                    ) : (
                      <span 
                        className="text-white font-semibold flex items-center gap-1 cursor-pointer hover:text-purple-300 transition" 
                        onClick={() => setEditingSection({oldName: section, newName: section})}
                        title="Ismi Degistirmek Icin Tikla"
                      >
                         {section} <span className="material-symbols-outlined text-[13px] opacity-60">edit</span>
                      </span>
                    )}
`;

if (d.includes(originalSpan)) {
    d = d.replace(originalSpan, editableSpan);
}

// 4. Update the TV button to say TV'yi Aç instead of just TV
d = d.replace(/>📺 TV<\/a>/g, ">📺 TV'yi Aç</a>");

fs.writeFileSync(p, d);
console.log("Patched rename logic and TV text");
