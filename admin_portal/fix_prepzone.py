import sys

file_path = "src/app/[locale]/admin/kermes/[id]/page.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

replacements = [
    (
        "prepZone?: string; // Hazırlık bölgesi e.g. K_ZONE, E_ZONE",
        "prepZone?: string[]; // Hazırlık bölgesi e.g. K_ZONE, E_ZONE"
    ),
    (
        "const [customProduct, setCustomProduct] = useState({ name: '', category: 'Ana Yemek', price: 0, prepZone: '' });",
        "const [customProduct, setCustomProduct] = useState({ name: '', category: 'Ana Yemek', price: 0, prepZone: [] as string[] });"
    ),
    (
        "setCustomProduct({ name: '', category: 'Ana Yemek', price: 0, prepZone: '' });",
        "setCustomProduct({ name: '', category: 'Ana Yemek', price: 0, prepZone: [] });"
    ),
    (
        "setProducts(productsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as KermesProduct)));",
        """setProducts(productsSnapshot.docs.map(d => {
            const data = d.data();
            let parsedPrepZone: string[] = [];
            if (data.prepZone) {
                if (Array.isArray(data.prepZone)) parsedPrepZone = data.prepZone;
                else parsedPrepZone = [String(data.prepZone)];
            }
            return { id: d.id, ...data, prepZone: parsedPrepZone } as KermesProduct;
        }));"""
    ),
    ("prepZone: editBeforeAdd.prepZone || null,", "prepZone: editBeforeAdd.prepZone || [],"),
    ("prepZone: editProduct.prepZone || null,", "prepZone: editProduct.prepZone || [],"),
    ("prepZone: customProduct.prepZone || null,", "prepZone: customProduct.prepZone || [],"),
    ("prepZone: product.prepZone || '',", "prepZone: product.prepZone || [],"),
    (
        "<input type=\"text\" value={customProduct.prepZone || ''} onChange={(e) => setCustomProduct({ ...customProduct, prepZone: e.target.value })}",
        "<input type=\"text\" value={customProduct.prepZone?.join(', ') || ''} onChange={(e) => setCustomProduct({ ...customProduct, prepZone: e.target.value.split(',').map(s=>s.trim()).filter(Boolean) })}"
    ),
    (
        "<input type=\"text\" value={editBeforeAdd.prepZone || ''}\n                                        onChange={(e) => setEditBeforeAdd({ ...editBeforeAdd, prepZone: e.target.value })}",
        "<input type=\"text\" value={editBeforeAdd.prepZone?.join(', ') || ''}\n                                        onChange={(e) => setEditBeforeAdd({ ...editBeforeAdd, prepZone: e.target.value.split(',').map(s=>s.trim()).filter(Boolean) })}"
    ),
    (
        "<input type=\"text\" value={editProduct.prepZone || ''}\n                                                onChange={(e) => setEditProduct({ ...editProduct, prepZone: e.target.value })}",
        "<input type=\"text\" value={editProduct.prepZone?.join(', ') || ''}\n                                                onChange={(e) => setEditProduct({ ...editProduct, prepZone: e.target.value.split(',').map(s=>s.trim()).filter(Boolean) })}"
    )
]

# There are also multiple lines: `prepZone?: string;` that need replacement inside `editBeforeAdd` etc.
# But replacing `prepZone?: string;` blindly is safe here.
content = content.replace("prepZone?: string;", "prepZone?: string[];")

for old_str, new_str in replacements:
    content = content.replace(old_str, new_str)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
