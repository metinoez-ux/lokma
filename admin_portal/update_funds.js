const admin = require('firebase-admin');
const fs = require('fs');

const serviceAccount = JSON.parse(fs.readFileSync('./service-account.json', 'utf8'));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

const fundsData = [
    {
        nameRegex: /MANA/i,
        updates: {
            logoUrl: 'https://mana.org.tr/wp-content/uploads/2023/06/Logo-Png.png',
            description: 'MANA Derneği, dünyanın dört bir yanındaki ihtiyaç sahiplerine umut olmayı hedefleyen köklü bir insani yardım kuruluşudur. Özellikle su kuyusu açma, acil gıda ve giyim yardımı ile yetim destekleme projelerine odaklanırlar. Kurdukları şeffaf sistem sayesinde her bir bağışın doğrudan mağdurlara ulaşması sağlanır. Dezavantajlı bölgelerde eğitim destekleri ve katarakt ameliyatları gibi kalıcı çözümler de sunarlar. "Bir Ömür İyilik" mottosuyla, bağışçılar ile ihtiyaç sahipleri arasında güvenilir bir köprü görevi üstlenirler.'
        }
    },
    {
        nameRegex: /İLA/i,
        excludeRegex: /Europe/i,
        updates: {
            logoUrl: 'https://iladernegi.org/wp-content/uploads/2022/10/ila-logo.png',
            description: 'İLA Derneği, öncelikli olarak eğitim, kültür ve insani yardım alanlarında faaliyet gösteren uluslararası bir sivil toplum kuruluşudur. Afrika ve Asya gibi dezavantajlı bölgelerde sürdürülebilir kalkınma projeleri yürütürken, Avrupa\'da kültürel uyum ve eğitim çalışmaları yaparlar. Eğitimde fırsat eşitliğini sağlamak amacıyla okul inşası ve burs programlarına büyük önem verirler. Kriz dönemlerinde acil durum müdahale ekipleriyle sahada aktif olarak görev alırlar. Toplumsal dayanışmayı küresel ölçekte güçlendirmeyi misyon edinmişlerdir.'
        }
    },
    {
        nameRegex: /Diversity/i,
        updates: {
            logoUrl: 'https://www.diversitydernegi.org/wp-content/uploads/2019/05/diversity_logo.png',
            description: 'Diversity Farklılık Derneği, insani yardım ve uluslararası kalkınma alanında faaliyet yürüten köklü bir kuruluştur. Ağırlıklı olarak Afrika kıtasında eğitim, sağlık ve yetimhane projeleriyle kalıcı eserler bırakmayı hedeflerler. Bölge halkının kendi kendine yetebilmesi için tarım ve mesleki eğitim projelerini hayata geçirirler. Kurban ve Ramazan dönemlerinde kapsamlı gıda yardımı organizasyonları düzenlerler. "Daha Aydınlık Bir Dünya" vizyonuyla, farklılıkları bir zenginlik olarak kabul edip ihtiyaç sahiplerinin elinden tutarlar.'
        }
    },
    {
        nameRegex: /Serhat/i,
        updates: {
            logoUrl: 'https://serhat.org/wp-content/uploads/2025/02/Untitled-design-1.png',
            description: 'Serhat Derneği, İstanbul merkezli olarak kurulan ve toplumsal dayanışmayı yaygınlaştırmayı amaçlayan bir iyilik hareketidir. Sosyal yardımlaşma faaliyetlerinin yanı sıra, yetim destekleme ve acil insani yardım projelerinde aktif rol oynarlar. Özellikle savaş ve afet mağduru çocukların rehabilitasyonu ve eğitimi üzerine özel çalışmalar yürütürler. Yerel ve uluslararası düzeyde birçok sivil toplum kuruluşuyla entegre projeler geliştirirler. İhtiyaç sahiplerinin kendi ayakları üzerinde durabileceği sürdürülebilir bir gelecek inşa etmeye odaklanırlar.'
        }
    },
    {
        nameRegex: /ILA Europe/i,
        updates: {
            logoUrl: 'https://ilaeurope.de/wp-content/uploads/2022/11/Ila-Europe-Logo-Web.png',
            description: 'ILA Europe, Avrupa merkezli faaliyet gösteren ve uluslararası insani krizlere hızlı müdahale eden saygın bir yardım kuruluşudur. Avrupa\'daki gönüllü ağı sayesinde küresel bağış kampanyaları düzenleyerek dezavantajlı coğrafyalara umut taşırlar. Sağlık, eğitim ve temiz su projeleri ile yoksullukla mücadelede sürdürülebilir çözümler üretirler. Mülteci krizleri ve doğal afetlerde acil kurtarma ve barınma destekleri sağlarlar. Şeffaflık ilkesiyle hareket ederek her bağışın doğrudan sahaya ulaşmasını garanti ederler.'
        }
    },
    {
        nameRegex: /Sahin/i,
        updates: {
            logoUrl: 'https://dr-sahin.help/wp-content/uploads/2022/01/logo.png',
            description: 'Dr. Şahin Help, kimsesiz çocuklara ve yetimlere sıcak bir öğün sağlamak amacıyla kurulmuş özel bir inisiyatiftir. Günlük olarak yüzlerce yetim ve aileye taze pişirilmiş yemekler ulaştırarak onların beslenme ihtiyaçlarını karşılarlar. Birçok çocuk için günün tek sıcak öğünü olan bu yardımlar, sadece karın doyurmakla kalmaz, onlara sevgi ve umut aşılar. Sağlık ve eğitim destekleriyle de çocukların gelişimine çok yönlü katkı sunarlar. Tamamen gönüllülük esasıyla çalışan kurum, bağışçıların destekleriyle her geçen gün daha fazla çocuğa ulaşmaktadır.'
        }
    }
];

async function run() {
    const snap = await db.collection('donation_funds').get();
    
    let updatedCount = 0;
    
    for (const doc of snap.docs) {
        const data = doc.data();
        let matched = false;
        
        for (const config of fundsData) {
            if (config.nameRegex.test(data.name) && (!config.excludeRegex || !config.excludeRegex.test(data.name))) {
                console.log(`Updating ${data.name}...`);
                await doc.ref.update(config.updates);
                updatedCount++;
                matched = true;
                break;
            }
        }
        
        if (!matched) {
            console.log(`No match for ${data.name}`);
        }
    }
    
    console.log(`Updated ${updatedCount} funds.`);
    process.exit(0);
}

run();
