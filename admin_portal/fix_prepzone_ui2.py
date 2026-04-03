import sys, re

file_path = "src/app/[locale]/admin/kermes/[id]/page.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Insert the PrepZoneSelector component
injection_target = "const DEFAULT_CATEGORIES = ['Ana Yemek', 'Çorba', 'Tatlı', 'İçecek', 'Aperatif', 'Grill', 'Diğer'];"

selector_code = """
const DEFAULT_PREP_ZONES = ["Kadınlar Standı", "Erkekler Standı", "İçecek Standı", "Tatlı Standı", "Döner Standı"];

function PrepZoneSelector({ value, onChange, products }: { value: string[], onChange: (val: string[]) => void, products: KermesProduct[] }) {
    const allZones = Array.from(new Set([...DEFAULT_PREP_ZONES, ...products.flatMap(p => p.prepZone || [])])).filter(Boolean).sort();
    
    const toggleZone = (zone: string) => {
        if (value.includes(zone)) onChange(value.filter(v => v !== zone));
        else onChange([...value, zone]);
    };

    const customValues = value.filter(v => !allZones.includes(v));

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
                {allZones.map(zone => (
                    <label key={zone} className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border cursor-pointer transition ${value.includes(zone) ? 'bg-pink-50 border-pink-200 dark:bg-pink-900/20 dark:border-pink-800' : 'bg-muted/30 border-border hover:bg-muted'}`}>
                        <input 
                            type="checkbox" 
                            checked={value.includes(zone)}
                            onChange={() => toggleZone(zone)}
                            className="rounded border-gray-300 text-pink-600 focus:ring-pink-500 w-4 h-4"
                        />
                        <span className={`text-sm ${value.includes(zone) ? 'font-medium text-pink-700 dark:text-pink-300' : 'text-foreground'}`}>{zone}</span>
                    </label>
                ))}
            </div>
            <div>
                <p className="text-xs text-muted-foreground mb-1">Farklı bir alan ekle (virgülle ayırın)</p>
                <input 
                    type="text" 
                    value={customValues.join(', ')}
                    onChange={(e) => {
                        const custom = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                        const selectedFromAll = value.filter(v => allZones.includes(v));
                        onChange([...selectedFromAll, ...custom]);
                    }}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-pink-500 text-sm"
                    placeholder="Örn: Mutfak, Bar"
                />
            </div>
        </div>
    );
}
"""

if "function PrepZoneSelector" not in content:
    content = content.replace(injection_target, injection_target + "\n" + selector_code)


content = re.sub(
    r'<input type="text" value=\{customProduct.prepZone\?\.join\(\', \'\) \|\| \'\'\}\s*onChange=\{\(e\) => setCustomProduct\(\{ \.\.\.customProduct, prepZone: e\.target\.value\.split\(\',\'\)\.map\(s=>s\.trim\(\)\)\.filter\(Boolean\) \}\)\}\s*className="[^"]*"\s*placeholder="[^"]*"\s*/>',
    r'<PrepZoneSelector value={customProduct.prepZone || []} onChange={(val) => setCustomProduct({ ...customProduct, prepZone: val })} products={products} />',
    content
)

content = re.sub(
    r'<input type="text" value=\{editBeforeAdd.prepZone\?\.join\(\', \'\) \|\| \'\'\}\s*onChange=\{\(e\) => setEditBeforeAdd\(\{ \.\.\.editBeforeAdd, prepZone: e\.target\.value\.split\(\',\'\)\.map\(s=>s\.trim\(\)\)\.filter\(Boolean\) \}\)\}\s*className="[^"]*"\s*placeholder="[^"]*"\s*/>',
    r'<PrepZoneSelector value={editBeforeAdd.prepZone || []} onChange={(val) => setEditBeforeAdd({ ...editBeforeAdd, prepZone: val })} products={products} />',
    content
)

content = re.sub(
    r'<input type="text" value=\{editProduct.prepZone\?\.join\(\', \'\) \|\| \'\'\}\s*onChange=\{\(e\) => setEditProduct\(\{ \.\.\.editProduct, prepZone: e\.target\.value\.split\(\',\'\)\.map\(s=>s\.trim\(\)\)\.filter\(Boolean\) \}\)\}\s*className="[^"]*"\s*placeholder="[^"]*"\s*/>',
    r'<PrepZoneSelector value={editProduct.prepZone || []} onChange={(val) => setEditProduct({ ...editProduct, prepZone: val })} products={products} />',
    content
)

# And if there are extra descriptive texts like: "Virgülle ayırarak birden fazla hazırlık noktası girebilirsiniz."
content = re.sub(r'<p className="text-xs text-muted-foreground mt-1">Virgülle ayırarak birden fazla hazırlık noktası girebilirsiniz.</p>', '', content)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Replacement Complete")
