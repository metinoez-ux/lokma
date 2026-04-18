const fs = require('fs');

const data = {
  tr: {
    note_product_label: 'Ürün Notu',
    note_product_placeholder: 'Örneğin „Lütfen soğanlar büyük olsun“'
  },
  de: {
    note_product_label: 'Produktnotiz',
    note_product_placeholder: 'Zum Beispiel „Bitte große Zwiebeln“'
  },
  en: {
    note_product_label: 'Product Note',
    note_product_placeholder: 'For example, "Large onions please"'
  },
  es: {
    note_product_label: 'Nota del producto',
    note_product_placeholder: 'Por ejemplo, „Por favor cebollas grandes“'
  },
  fr: {
    note_product_label: 'Note du produit',
    note_product_placeholder: 'Par exemple « Gros oignons s\'il vous plaît »'
  },
  it: {
    note_product_label: 'Nota sul prodotto',
    note_product_placeholder: 'Per esempio, "Cipolle grandi per favore"'
  },
  nl: {
    note_product_label: 'Productnotitie',
    note_product_placeholder: 'Bijvoorbeeld, "Graag grote uien"'
  }
};

const dir = 'assets/translations';
for (const [lang, translations] of Object.entries(data)) {
  const filePath = `${dir}/${lang}.json`;
  if (fs.existsSync(filePath)) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    
    // Add to cart section
    if (parsed.cart) {
      parsed.cart.note_product_label = translations.note_product_label;
      parsed.cart.note_product_placeholder = translations.note_product_placeholder;
    }
    
    fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2));
    console.log(`Updated ${lang}.json`);
  }
}
