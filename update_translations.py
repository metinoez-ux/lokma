import os
import json

directory = '/Users/metinoz/Developer/LOKMA_MASTER/mobile_app/assets/translations'
tr_translation = "Bu gördüğünüz sertifika logosu sadece {brandName} tarafından verilmekte ve kontrol edilmektedir. Eğer bir işletme {brandName} ile çalışmayı bırakırsa, anında bu logo işletme sayfasından kaldırılır. Bu emniyet sertifikası LOKMA platformu tarafından verilmemektedir; kontrol tamamıyla {brandName} yetkililerine aittir."
de_translation = "Dieses Zertifikatslogo wird ausschließlich von {brandName} vergeben und kontrolliert. Sobald ein Geschäft die Zusammenarbeit mit {brandName} beendet, wird dieses Logo umgehend von der Geschäftsseite entfernt. Dieses Sicherheitszertifikat wird nicht von der LOKMA-Plattform ausgestellt; die vollständige Kontrolle liegt bei {brandName}."
en_translation = "This certificate logo is issued and controlled solely by {brandName}. If a business stops working with {brandName}, this logo will be immediately removed from their page. This safety certificate is not issued by the LOKMA platform; full control belongs entirely to {brandName}."
fr_translation = "Ce logo de certificat est délivré et contrôlé uniquement par {brandName}. Si une entreprise cesse de travailler avec {brandName}, ce logo sera immédiatement retiré de sa page. Ce certificat de sécurité n'est pas délivré par la plateforme LOKMA ; le contrôle total appartient à {brandName}."

for filename in os.listdir(directory):
    if filename.endswith(".json"):
        filepath = os.path.join(directory, filename)
        with open(filepath, 'r+', encoding='utf-8') as f:
            content = json.load(f)
            
            if 'marketplace' not in content:
                content['marketplace'] = {}
                
            if filename == 'tr.json':
                content['marketplace']['brand_disclaimer'] = tr_translation
            elif filename == 'de.json':
                content['marketplace']['brand_disclaimer'] = de_translation
            elif filename == 'en.json':
                content['marketplace']['brand_disclaimer'] = en_translation
            elif filename == 'fr.json':
                content['marketplace']['brand_disclaimer'] = fr_translation
            else:
                content['marketplace']['brand_disclaimer'] = en_translation
                
            f.seek(0)
            json.dump(content, f, indent=2, ensure_ascii=False)
            f.truncate()
            print(f"Updated {filename}")
