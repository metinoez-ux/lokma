import os
import json

directory = '/Users/metinoz/Developer/LOKMA_MASTER/mobile_app/assets/translations'
tr_translation = "Bu gördüğünüz emniyet sertifikası ve logosu, doğrudan {brandName} tarafından işletmelere verilmekte ve düzenli olarak kendileri tarafından denetlenmektedir. Herhangi bir işletme {brandName} ürünlerinin satışını durdurduğu an, bu logo ve sertifika LOKMA platformu üzerindeki işletme profilinden derhal ve otomatik olarak kaldırılır. Kısacası, bu güvenlik standardının LOKMA platformu ile doğrudan bir bağı yoktur; tüm inisiyatif ve kontrol bizzat {brandName} yetkililerine aittir."
de_translation = "Dieses abgebildete Zertifikat und Logo werden direkt von {brandName} an die Betriebe vergeben und regelmäßig von ihnen selbst kontrolliert. Sobald ein Betrieb den Verkauf von {brandName}-Produkten einstellt, wird dieses Logo umgehend aus dem Profil des Geschäfts auf der LOKMA-Plattform entfernt. Kurzum: Dieser Sicherheitsstandard wird nicht von LOKMA vergeben, die vollständige Kontrolle und Verantwortung liegt ausschließlich bei {brandName}."
en_translation = "This safety certificate and logo are issued directly by {brandName} to the businesses and are regularly audited by them. As soon as a business stops selling {brandName} products, this logo will be immediately removed from the business's profile on the LOKMA platform. In short, this safety standard is not issued by LOKMA; full control and responsibility lie exclusively with {brandName}."
fr_translation = "Ce certificat de sécurité et ce logo sont délivrés directement par {brandName} aux entreprises et sont régulièrement audités par elles. Dès qu'une entreprise cesse de vendre des produits {brandName}, ce logo sera immédiatement retiré du profil de l'entreprise sur la plateforme LOKMA. En bref, ce standard de sécurité n'est pas délivré par LOKMA ; le contrôle et la responsabilité incombent exclusivement à {brandName}."

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
