const fs = require('fs');
const path = require('path');

const locales = ['tr', 'de', 'en', 'es', 'fr', 'it', 'nl'];
const messagesDir = '/Users/metinoz/.gemini/antigravity/scratch/LOKMA_2026/admin_portal/messages';

const translations = {
    tr: {
        title: "Alın Terinizin Karşılığını Alın: Lokma'ya Katılın!",
        subtitle: "Esnaf dostu platformumuzla tanışın. Sizin kazancınız, bizim önceliğimiz.",
        applyNow: "Hemen Başvurun",
        benefitsTitle: "Neden Bizimle Çalışmalısınız?",
        benefitCommTitle: "Düşük Komisyon",
        benefitCommDesc: "Sektördeki en adil ve düşük komisyon oranlarıyla emeğinizin karşılığını tam alın.",
        benefitPayTitle: "Hızlı Ödeme",
        benefitPayDesc: "Haftalarca beklemek yok. Ödemeleriniz hızlı ve düzenli olarak hesabınızda.",
        benefitControlTitle: "Panel Kontrolü",
        benefitControlDesc: "Menünüzü, çalışma saatlerinizi ve siparişlerinizi özel esnaf panelinden kolayca yönetin.",
        benefitVisTitle: "Yüksek Görünürlük",
        benefitVisDesc: "Geniş müşteri ağımız sayesinde restoranınızı daha fazla kişiye ulaştırın, satışlarınızı artırın.",
        howItWorksTitle: "Nasıl Çalışır?",
        step1Title: "Başvuru",
        step1Desc: "Formu doldurun ve belgelerinizi iletin.",
        step2Title: "Kurulum",
        step2Desc: "Menünüzü ve panelinizi hızlıca hazırlayalım.",
        step3Title: "Satışa Başlayın",
        step3Desc: "Siparişleri alın ve kazanmaya başlayın!",
        ctaSubtext: "Ücretsiz başvuru • Hızlı onay süreci"
    },
    de: {
        title: "Erhalten Sie den Lohn für Ihre harte Arbeit: Werden Sie Teil von Lokma!",
        subtitle: "Lernen Sie unsere händlerfreundliche Plattform kennen. Ihr Verdienst ist unsere Priorität.",
        applyNow: "Jetzt bewerben",
        benefitsTitle: "Warum sollten Sie mit uns arbeiten?",
        benefitCommTitle: "Niedrige Provision",
        benefitCommDesc: "Erhalten Sie mit den fairsten und niedrigsten Provisionssätzen der Branche den vollen Gegenwert für Ihre Arbeit.",
        benefitPayTitle: "Schnelle Auszahlung",
        benefitPayDesc: "Kein wochenlanges Warten. Ihre Zahlungen erfolgen schnell und regelmäßig auf Ihr Konto.",
        benefitControlTitle: "Panel-Kontrolle",
        benefitControlDesc: "Verwalten Sie Ihre Speisekarte, Arbeitszeiten und Bestellungen ganz einfach über Ihr spezielles Händler-Panel.",
        benefitVisTitle: "Hohe Sichtbarkeit",
        benefitVisDesc: "Erreichen Sie durch unser großes Kundennetzwerk mehr Menschen und steigern Sie Ihren Umsatz.",
        howItWorksTitle: "Wie funktioniert es?",
        step1Title: "Bewerbung",
        step1Desc: "Füllen Sie das Formular aus und senden Sie uns Ihre Dokumente.",
        step2Title: "Einrichtung",
        step2Desc: "Wir bereiten Ihre Speisekarte und Ihr Panel schnell vor.",
        step3Title: "Beginnen Sie mit dem Verkauf",
        step3Desc: "Nehmen Sie Bestellungen an und fangen Sie an zu verdienen!",
        ctaSubtext: "Kostenlose Bewerbung • Schneller Genehmigungsprozess"
    },
    en: {
        title: "Get What You Earn: Join Lokma!",
        subtitle: "Meet our merchant-friendly platform. Your earnings are our priority.",
        applyNow: "Apply Now",
        benefitsTitle: "Why Work With Us?",
        benefitCommTitle: "Low Commission",
        benefitCommDesc: "Get the full value of your hard work with the fairest and lowest commission rates in the industry.",
        benefitPayTitle: "Fast Payment",
        benefitPayDesc: "No waiting for weeks. Your payments are in your account quickly and regularly.",
        benefitControlTitle: "Panel Control",
        benefitControlDesc: "Easily manage your menu, working hours, and orders from your dedicated merchant panel.",
        benefitVisTitle: "High Visibility",
        benefitVisDesc: "Reach more people and increase your sales thanks to our large customer network.",
        howItWorksTitle: "How It Works?",
        step1Title: "Application",
        step1Desc: "Fill out the form and submit your documents.",
        step2Title: "Setup",
        step2Desc: "We quickly prepare your menu and panel.",
        step3Title: "Start Selling",
        step3Desc: "Take orders and start earning!",
        ctaSubtext: "Free application • Fast approval process"
    }
};

// Fallback to English
['es', 'fr', 'it', 'nl'].forEach(loc => {
    translations[loc] = { ...translations.en };
});

locales.forEach(loc => {
    const filePath = path.join(messagesDir, `${loc}.json`);
    if (fs.existsSync(filePath)) {
        const rawData = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(rawData);

        data.Partner = translations[loc];

        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        console.log(`Updated Partner translations for ${loc}`);
    }
});
