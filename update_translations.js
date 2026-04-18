const fs = require('fs');
const path = require('path');

const dir = '/Users/metinoz/Developer/LOKMA_MASTER/mobile_app/assets/translations';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

const trTranslation = "Bu gördüğünüz sertifika logosu sadece {brandName} tarafından verilmekte ve kontrol edilmektedir. Eğer bir işletme {brandName} ile çalışmayı bırakırsa, anında bu logo işletme sayfasından kaldırılır. Bu emniyet sertifikası LOKMA platformu tarafından verilmemektedir; kontrol tamamıyla {brandName} yetkililerine aittir.";
const deTranslation = "Dieses Zertifikatslogo wird ausschließlich von {brandName} vergeben und kontrolliert. Sobald ein Geschäft die Zusammenarbeit mit {brandName} beendet, wird dieses Logo umgehend von der Geschäftsseite entfernt. Dieses Sicherheitszertifikat wird nicht von der LOKMA-Plattform ausgestellt; die vollständige Kontrolle liegt bei {brandName}.";
const enTranslation = "This certificate logo is issued and controlled solely by {brandName}. If a business stops working with {brandName}, this logo will be immediately removed from their page. This safety certificate is not issued by the LOKMA platform; full control belongs entirely to {brandName}.";
const frTranslation = "Ce logo de certificat est délivré et contrôlé uniquement par {brandName}. Si une entreprise cesse de travailler avec {brandName}, ce logo sera immédiatement retiré de sa page. Ce certificat de sécurité n'est pas délivré par la plateforme LOKMA ; le contrôle total appartient à {brandName}.";

for (const file of files) {
    const filePath = path.join(dir, file);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    if (!content.marketplace) {
        content.marketplace = {};
    }
    
    if (file === 'tr.json') {
        content.marketplace.brand_disclaimer = trTranslation;
    } else if (file === 'de.json') {
        content.marketplace.brand_disclaimer = deTranslation;
    } else if (file === 'en.json') {
        content.marketplace.brand_disclaimer = enTranslation;
    } else if (file === 'fr.json') {
        content.marketplace.brand_disclaimer = frTranslation;
    } else if (file === 'nl.json') {
        content.marketplace.brand_disclaimer = enTranslation; // Fallback
    } else if (file === 'es.json') {
        content.marketplace.brand_disclaimer = enTranslation; // Fallback
    } else if (file === 'it.json') {
        content.marketplace.brand_disclaimer = enTranslation; // Fallback
    } else {
        content.marketplace.brand_disclaimer = enTranslation;
    }
    
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
    console.log(`Updated ${file}`);
}
