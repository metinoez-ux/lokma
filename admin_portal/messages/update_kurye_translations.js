const fs = require('fs');
const path = require('path');

const locales = ['tr', 'de', 'en', 'es', 'fr', 'it', 'nl'];
const messagesDir = '/Users/metinoz/.gemini/antigravity/scratch/LOKMA_2026/admin_portal/messages';

const translations = {
    tr: {
        title: "Lokma Kuryesi Ol, Kendi İşinin Patronu Ol!",
        subtitle: "Esnek saatlerle çalış, kazancını sen belirle. Mahallenin en taze lezzetlerini taşırken LOKMA ailesinin bir parçası ol.",
        applyNow: "Hemen Başvur",
        benefitsTitle: "Seni Neler Bekliyor?",
        benefitFlexTitle: "Tam Esneklik",
        benefitFlexDesc: "Ne zaman ve ne kadar çalışacağına sen karar ver.",
        benefitEarnTitle: "Şeffaf Kazanç",
        benefitEarnDesc: "Her teslimat için kazancını önceden bil, sürprizlerle karşılaşma.",
        benefitSupportTitle: "7/24 Destek",
        benefitSupportDesc: "Yoldayken asla yalnız değilsin, canlı destek ekibimiz her zaman yanında.",
        reqTitle: "Almanya Şartları",
        req1: "En az 18 yaşında olmak",
        req2: "Almanya'da geçerli çalışma izni",
        req3: "Gewerbeschein (Serbest Çalışan) veya Minijob",
        req4: "Akıllı telefon (iOS/Android) ve internet paketi",
        req5: "Bisiklet, e-bike, scooter veya araba",
        stepsTitle: "Nasıl Kurye Olunur?",
        step1Title: "Başvuru Formuna Git",
        step1Desc: "Kısa formu doldur ve bilgilerini bize ilet.",
        step2Title: "Belgeleri Yükle",
        step2Desc: "Gerekli belgeleri online sistemimiz üzerinden kolayca yükle.",
        step3Title: "Hızlı Eğitim",
        step3Desc: "LOKMA standartlarını öğrenmek için kısa online eğitimimizi tamamla.",
        step4Title: "Yollara Çık!",
        step4Desc: "Ekipmanını al ve hemen kazanmaya başla."
    },
    de: {
        title: "Werde Lokma-Kurier, sei dein eigener Chef!",
        subtitle: "Arbeite mit flexiblen Zeiten und bestimme dein Einkommen selbst. Sei Teil der LOKMA-Familie, während du die frischesten Köstlichkeiten der Nachbarschaft lieferst.",
        applyNow: "Jetzt bewerben",
        benefitsTitle: "Was erwartet dich?",
        benefitFlexTitle: "Volle Flexibilität",
        benefitFlexDesc: "Du entscheidest, wann und wie viel du arbeitest.",
        benefitEarnTitle: "Transparenter Verdienst",
        benefitEarnDesc: "Kenne deinen Verdienst für jede Lieferung im Voraus, keine Überraschungen.",
        benefitSupportTitle: "24/7 Support",
        benefitSupportDesc: "Du bist unterwegs nie allein, unser Live-Support-Team ist immer für dich da.",
        reqTitle: "Voraussetzungen in Deutschland",
        req1: "Mindestens 18 Jahre alt sein",
        req2: "Gültige Arbeitserlaubnis in Deutschland",
        req3: "Gewerbeschein oder Minijob",
        req4: "Smartphone (iOS/Android) und Datenvolumen",
        req5: "Fahrrad, E-Bike, Roller oder Auto",
        stepsTitle: "Wie wird man Kurier?",
        step1Title: "Gehe zum Bewerbungsformular",
        step1Desc: "Fülle das kurze Formular aus und sende uns deine Daten.",
        step2Title: "Dokumente hochladen",
        step2Desc: "Lade die erforderlichen Dokumente einfach in unser Online-System hoch.",
        step3Title: "Schnelles Training",
        step3Desc: "Absolviere unser kurzes Online-Training, um die LOKMA-Standards kennenzulernen.",
        step4Title: "Auf die Straße!",
        step4Desc: "Hol dir deine Ausrüstung und fange sofort an zu verdienen."
    },
    en: {
        title: "Become a Lokma Courier, Be Your Own Boss!",
        subtitle: "Work with flexible hours and determine your own earnings. Be a part of the LOKMA family while delivering the neighborhood's freshest flavors.",
        applyNow: "Apply Now",
        benefitsTitle: "What Awaits You?",
        benefitFlexTitle: "Full Flexibility",
        benefitFlexDesc: "You decide when and how much you work.",
        benefitEarnTitle: "Transparent Earnings",
        benefitEarnDesc: "Know your earnings for each delivery in advance, no surprises.",
        benefitSupportTitle: "24/7 Support",
        benefitSupportDesc: "You are never alone on the road, our live support team is always with you.",
        reqTitle: "Requirements in Germany",
        req1: "Be at least 18 years old",
        req2: "Valid work permit in Germany",
        req3: "Gewerbeschein (Freelance) or Minijob",
        req4: "Smartphone (iOS/Android) and data plan",
        req5: "Bicycle, e-bike, scooter, or car",
        stepsTitle: "How to Become a Courier?",
        step1Title: "Go to the Application Form",
        step1Desc: "Fill out the short form and send us your information.",
        step2Title: "Upload Documents",
        step2Desc: "Easily upload the required documents through our online system.",
        step3Title: "Quick Training",
        step3Desc: "Complete our short online training to learn the LOKMA standards.",
        step4Title: "Hit the Road!",
        step4Desc: "Get your equipment and start earning immediately."
    }
};

// Fallback to English for un-translated ones
['es', 'fr', 'it', 'nl'].forEach(loc => {
    translations[loc] = { ...translations.en };
});

locales.forEach(loc => {
    const filePath = path.join(messagesDir, `${loc}.json`);
    if (fs.existsSync(filePath)) {
        const rawData = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(rawData);

        data.Kurye = translations[loc];

        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        console.log(`Updated Kurye translations for ${loc}`);
    } else {
        console.log(`File not found: ${loc}.json`);
    }
});
