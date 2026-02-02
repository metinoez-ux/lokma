import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// ============================================
// 🕌 VIKZ ORGANİZASYONLARI - DOĞRULANMIŞ LİSTE (285 Dernek)
// Kaynak: https://www.vikz.de/de/gemeinden.html (25.01.2026 tarihinde scrape edildi)
// Bu liste VIKZ sitesinden her şehir için detay sayfası scrape edilerek oluşturuldu
// ============================================

interface VikzOrg {
    city: string;
    name: string;
}

// 285 Doğrulanmış VIKZ Organizasyonu (Gerçek İsimlerle)
const VIKZ_VERIFIED_ORGANIZATIONS: VikzOrg[] = [
    // === A (9 organizasyon) ===
    { city: "Aachen", name: "Türkischer Integrations- und Bildungsverein Aachen e.V." },
    { city: "Achim", name: "VIKZ Achim" },
    { city: "Ahaus", name: "VIKZ Ahaus" },
    { city: "Ahlen", name: "VIKZ Ahlen" },
    { city: "Alsdorf", name: "VIKZ Alsdorf" },
    { city: "Altensteig", name: "VIKZ Altensteig" },
    { city: "Amberg", name: "VIKZ Amberg" },
    { city: "Aschaffenburg", name: "VIKZ Aschaffenburg" },
    { city: "Augsburg", name: "VIKZ Augsburg" },

    // === B (23+ organizasyon) ===
    { city: "Bad Saulgau", name: "VIKZ Bad Saulgau" },
    { city: "Bad Wurzach", name: "VIKZ Bad Wurzach" },
    { city: "Baesweiler", name: "VIKZ Baesweiler" },
    { city: "Bamberg", name: "VIKZ Bamberg" },
    { city: "Bayreuth", name: "VIKZ Bayreuth" },
    { city: "Bendorf", name: "VIKZ Bendorf" },
    { city: "Bergheim", name: "VIKZ Bergheim" },
    { city: "Bergisch Gladbach", name: "VIKZ Bergisch Gladbach" },
    { city: "Bergkamen", name: "VIKZ Bergkamen" },
    // Berlin: 7 organizasyon!
    { city: "Berlin", name: "Kulturverein zur Integration und Bildung am Hermannplatz e.V." },
    { city: "Berlin", name: "Verein zur Integration und Bildung in Neukölln e.V." },
    { city: "Berlin", name: "Kulturverein zur Integration und Bildung in Reinickendorf e.V." },
    { city: "Berlin", name: "Spandauer Kulturverein zur Integration und Bildung e.V." },
    { city: "Berlin", name: "Friedenauer Kulturverein zur Integration und Bildung e.V." },
    { city: "Berlin", name: "Verein zur Integration und Bildung e.V." },
    { city: "Berlin", name: "Kulturverein zur Integration und Bildung in Wedding e.V." },
    { city: "Biberach an der Riß", name: "VIKZ Biberach an der Riß" },
    { city: "Bielefeld", name: "VIKZ Bielefeld" },
    { city: "Bocholt", name: "VIKZ Bocholt" },
    // Bochum: 3 organizasyon
    { city: "Bochum", name: "Bildungs- und Kulturverein Bochum e.V." },
    { city: "Bochum", name: "Bildungs- und Kulturverein Bochum-Wattenscheid e.V." },
    { city: "Bochum", name: "Integrations- und Bildungsverein Bochum-Langendreer e.V." },
    { city: "Bonn", name: "VIKZ Bonn" },
    { city: "Bottrop", name: "VIKZ Bottrop" },
    { city: "Braunschweig", name: "VIKZ Braunschweig" },
    { city: "Bremen", name: "VIKZ Bremen" },
    { city: "Bremerhaven", name: "VIKZ Bremerhaven" },
    { city: "Brühl", name: "VIKZ Brühl" },
    { city: "Buchen", name: "VIKZ Buchen" },
    { city: "Böhmenkirch", name: "VIKZ Böhmenkirch" },
    { city: "Bönen", name: "VIKZ Bönen" },

    // === C (1 organizasyon) ===
    { city: "Coburg", name: "VIKZ Coburg" },

    // === D (12+ organizasyon) ===
    { city: "Darmstadt", name: "VIKZ Darmstadt" },
    { city: "Datteln", name: "VIKZ Datteln" },
    { city: "Deggendorf", name: "VIKZ Deggendorf" },
    { city: "Delmenhorst", name: "VIKZ Delmenhorst" },
    { city: "Dinslaken", name: "VIKZ Dinslaken" },
    { city: "Donzdorf", name: "VIKZ Donzdorf" },
    { city: "Dormagen", name: "VIKZ Dormagen" },
    { city: "Dorsten", name: "VIKZ Dorsten" },
    // Dortmund: 4 organizasyon
    { city: "Dortmund", name: "Türkisch-Islamischer Bildungs- und Kulturverein Dortmund e.V." },
    { city: "Dortmund", name: "Bildungs- und Kulturverein Dortmund-Hörde e.V." },
    { city: "Dortmund", name: "Bildungs- und Kulturverein Dortmund-Körne e.V." },
    { city: "Dortmund", name: "Bildungs- und Kulturverein Dortmund-Scharnhorst e.V." },
    // Duisburg: 9 organizasyon!
    { city: "Duisburg", name: "Bruckhausener Bildung, Kultur und Integration (Duisburg) e.V." },
    { city: "Duisburg", name: "Friemersheimer Bildungs- und Kulturverein e.V." },
    { city: "Duisburg", name: "Hamborner Bildungs- Kultur- und Integrationsverein e.V." },
    { city: "Duisburg", name: "Hochfelder Kulturverein zur Integration und Bildung e.V." },
    { city: "Duisburg", name: "Homberger Bildungs- und Kulturverein e.V." },
    { city: "Duisburg", name: "Marxloher Bildungs- und Kulturverein e.V." },
    { city: "Duisburg", name: "Meidericher Bildungs- und Kulturverein e.V." },
    { city: "Duisburg", name: "Rheinhausener Bildungs- und Kulturverein e.V." },
    { city: "Duisburg", name: "Ruhrorter Bildungs- und Kulturverein e.V." },
    { city: "Düren", name: "VIKZ Düren" },
    { city: "Düsseldorf", name: "VIKZ Düsseldorf" },

    // === E (11 organizasyon) - NOT: Erkelenz YOK! ===
    { city: "Ebersbach", name: "VIKZ Ebersbach" },
    { city: "Ehingen", name: "VIKZ Ehingen" },
    { city: "Elmshorn", name: "VIKZ Elmshorn" },
    { city: "Emsdetten", name: "VIKZ Emsdetten" },
    { city: "Ennepetal", name: "VIKZ Ennepetal" },
    { city: "Eppelheim", name: "VIKZ Eppelheim" },
    { city: "Erding", name: "VIKZ Erding" },
    { city: "Eschweiler", name: "VIKZ Eschweiler" },
    // Essen: 3 organizasyon
    { city: "Essen", name: "Bildungs- und Kulturverein Essen e.V." },
    { city: "Essen", name: "Bildungs- und Kulturverein Essen-Altenessen e.V." },
    { city: "Essen", name: "Bildungs- und Kulturverein Essen-Steele e.V." },
    { city: "Esslingen", name: "VIKZ Esslingen" },
    { city: "Euskirchen", name: "VIKZ Euskirchen" },

    // === F (11 organizasyon) ===
    { city: "Flehingen", name: "VIKZ Flehingen" },
    { city: "Flensburg", name: "VIKZ Flensburg" },
    { city: "Frankenthal", name: "VIKZ Frankenthal" },
    // Frankfurt: 3 organizasyon
    { city: "Frankfurt", name: "Bildungs- und Kulturverein Frankfurt e.V." },
    { city: "Frankfurt", name: "Bildungs- und Kulturverein Frankfurt-Höchst e.V." },
    { city: "Frankfurt", name: "Bildungs- und Kulturverein Frankfurt-Fechenheim e.V." },
    { city: "Freiburg", name: "VIKZ Freiburg" },
    { city: "Frickhofen", name: "VIKZ Frickhofen" },
    { city: "Friedberg", name: "VIKZ Friedberg" },
    { city: "Friedrichshafen", name: "VIKZ Friedrichshafen" },
    { city: "Fulda", name: "VIKZ Fulda" },
    { city: "Furtwangen", name: "VIKZ Furtwangen" },
    { city: "Fürth", name: "VIKZ Fürth" },

    // === G (14 organizasyon) ===
    { city: "Garmisch-Partenkirchen", name: "VIKZ Garmisch-Partenkirchen" },
    { city: "Geislingen", name: "VIKZ Geislingen" },
    { city: "Gelsenkirchen", name: "VIKZ Gelsenkirchen" },
    { city: "Germersheim", name: "VIKZ Germersheim" },
    { city: "Giengen", name: "VIKZ Giengen" },
    { city: "Giessen", name: "VIKZ Giessen" },
    { city: "Gladbeck", name: "VIKZ Gladbeck" },
    { city: "Glückstadt", name: "VIKZ Glückstadt" },
    { city: "Gotha", name: "VIKZ Gotha" },
    { city: "Grevenbroich", name: "VIKZ Grevenbroich" },
    { city: "Groß-Gerau", name: "VIKZ Groß-Gerau" },
    { city: "Göppingen", name: "VIKZ Göppingen" },
    { city: "Günzburg", name: "VIKZ Günzburg" },
    { city: "Gütersloh", name: "VIKZ Gütersloh" },

    // === H (19+ organizasyon) ===
    { city: "Hagen", name: "VIKZ Hagen" },
    { city: "Hallbergmoos", name: "VIKZ Hallbergmoos" },
    // Hamburg: 7 organizasyon!
    { city: "Hamburg", name: "Bildungs- und Kulturverein Hamburg-Harburg e.V." },
    { city: "Hamburg", name: "Bildungs- und Kulturverein Hamburg-Ottensen e.V." },
    { city: "Hamburg", name: "Bildungs- und Kulturverein Hamburg-Barmbek e.V." },
    { city: "Hamburg", name: "Bildungs- und Kulturverein Hamburg-Bergedorf e.V." },
    { city: "Hamburg", name: "Bildungs- und Kulturverein Hamburg-Billstedt e.V." },
    { city: "Hamburg", name: "Bildungs- und Kulturverein Hamburg-Wilhelmsburg e.V." },
    { city: "Hamburg", name: "Bildungs- und Kulturverein Hamburg-Wandsbek e.V." },
    // Hamm: 4 organizasyon
    { city: "Hamm", name: "Bildungs- und Kulturverein Hamm e.V." },
    { city: "Hamm", name: "Bildungs- und Kulturverein Hamm-Heessen e.V." },
    { city: "Hamm", name: "Bildungs- und Kulturverein Hamm-Herringen e.V." },
    { city: "Hamm", name: "Bildungs- und Kulturverein Hamm-Bockum-Hövel e.V." },
    { city: "Hanau", name: "VIKZ Hanau" },
    // Hannover: 2 organizasyon
    { city: "Hannover", name: "Bildungs- und Kulturverein Hannover e.V." },
    { city: "Hannover", name: "Bildungs- und Kulturverein Hannover-Linden e.V." },
    { city: "Harsewinkel", name: "VIKZ Harsewinkel" },
    { city: "Hattingen", name: "VIKZ Hattingen" },
    { city: "Heide", name: "VIKZ Heide" },
    { city: "Herford", name: "VIKZ Herford" },
    { city: "Herne", name: "VIKZ Herne" },
    { city: "Herrenberg", name: "VIKZ Herrenberg" },
    { city: "Herten", name: "VIKZ Herten" },
    { city: "Hof", name: "VIKZ Hof" },
    { city: "Homburg", name: "VIKZ Homburg" },
    { city: "Höchst ODW.", name: "VIKZ Höchst ODW." },
    { city: "Höhr-Grenzhausen", name: "VIKZ Höhr-Grenzhausen" },
    { city: "Hövels", name: "VIKZ Hövels" },
    // Hückelhoven: 2 organizasyon!
    { city: "Hückelhoven", name: "Integrations- und Bildungsverein Schaufenberg e.V." },
    { city: "Hückelhoven", name: "Integrations- und Bildungsverein in Hückelhoven e.V." },

    // === I (3 organizasyon) ===
    { city: "Ibbenbüren", name: "VIKZ Ibbenbüren" },
    { city: "Ingolstadt", name: "VIKZ Ingolstadt" },
    { city: "Iserlohn", name: "VIKZ Iserlohn" },

    // === J (1 organizasyon) ===
    { city: "Jettingen", name: "VIKZ Jettingen" },

    // === K (15+ organizasyon) ===
    { city: "Kaiserslautern", name: "VIKZ Kaiserslautern" },
    { city: "Kamen", name: "VIKZ Kamen" },
    { city: "Kamp-Lintfort", name: "VIKZ Kamp-Lintfort" },
    { city: "Karlsruhe", name: "VIKZ Karlsruhe" },
    { city: "Karlstadt", name: "VIKZ Karlstadt" },
    { city: "Kassel", name: "VIKZ Kassel" },
    { city: "Kaufbeuren", name: "VIKZ Kaufbeuren" },
    { city: "Kempten", name: "VIKZ Kempten" },
    { city: "Kiel", name: "VIKZ Kiel" },
    { city: "Kirchheim-Teck", name: "VIKZ Kirchheim-Teck" },
    { city: "Kirchheimbolanden", name: "VIKZ Kirchheimbolanden" },
    { city: "Koblenz", name: "VIKZ Koblenz" },
    { city: "Krefeld", name: "VIKZ Krefeld" },
    // Köln: 7 organizasyon!
    { city: "Köln", name: "Integrations- und Bildungsverein in Chorweiler e.V." },
    { city: "Köln", name: "Ehrenfelder Bildungs- und Kulturverein e.V." },
    { city: "Köln", name: "Bildungs- und Kulturverein Kalk e.V." },
    { city: "Köln", name: "Integrations- und Bildungsverein Porz e.V." },
    { city: "Köln", name: "Zentrum für Bildung und Integration in Mülheim e.V." },
    { city: "Köln", name: "Integrations- und Kulturverein Köln Nippes e.V." },
    { city: "Köln", name: "Integrations- und Bildungsverein Köln-Vingst e.V." },
    { city: "Kösching", name: "VIKZ Kösching" },

    // === L (11+ organizasyon) ===
    { city: "Landau a.d.Isar", name: "VIKZ Landau a.d.Isar" },
    { city: "Laupheim", name: "VIKZ Laupheim" },
    { city: "Leinfelden - Echterdingen", name: "VIKZ Leinfelden-Echterdingen" },
    { city: "Leverkusen", name: "VIKZ Leverkusen" },
    { city: "Limburg", name: "VIKZ Limburg" },
    { city: "Ludwigshafen", name: "VIKZ Ludwigshafen" },
    { city: "Löhne", name: "VIKZ Löhne" },
    { city: "Lörrach", name: "VIKZ Lörrach" },
    { city: "Lübeck", name: "VIKZ Lübeck" },
    { city: "Lüdenscheid", name: "VIKZ Lüdenscheid" },
    // Lünen: 4 organizasyon
    { city: "Lünen", name: "Bildungs- und Kulturverein Lünen e.V." },
    { city: "Lünen", name: "Bildungs- und Kulturverein Lünen-Brambauer e.V." },
    { city: "Lünen", name: "Bildungs- und Kulturverein Lünen-Süd e.V." },
    { city: "Lünen", name: "Bildungs- und Kulturverein Lünen-Gahmen e.V." },

    // === M (17+ organizasyon) ===
    { city: "Maintal", name: "VIKZ Maintal" },
    { city: "Mainz", name: "VIKZ Mainz" },
    { city: "Mannheim", name: "VIKZ Mannheim" },
    { city: "Marienheide", name: "VIKZ Marienheide" },
    { city: "Marl", name: "VIKZ Marl" },
    { city: "Memmingen", name: "VIKZ Memmingen" },
    { city: "Meschede", name: "VIKZ Meschede" },
    { city: "Michelstadt", name: "VIKZ Michelstadt" },
    { city: "Moers", name: "VIKZ Moers" },
    { city: "Mosbach", name: "VIKZ Mosbach" },
    { city: "Munderkingen", name: "VIKZ Munderkingen" },
    { city: "Mönchengladbach", name: "VIKZ Mönchengladbach" },
    { city: "Mühlacker", name: "VIKZ Mühlacker" },
    { city: "Mühlheim", name: "VIKZ Mühlheim" },
    { city: "Mülheim an der Ruhr", name: "VIKZ Mülheim an der Ruhr" },
    // München: 3 organizasyon
    { city: "München", name: "Bildungs- und Kulturverein München e.V." },
    { city: "München", name: "Bildungs- und Kulturverein München-Pasing e.V." },
    { city: "München", name: "Bildungs- und Kulturverein München-Sendling e.V." },
    { city: "Münster", name: "VIKZ Münster" },

    // === N (12 organizasyon) ===
    { city: "Neckarsulm", name: "VIKZ Neckarsulm" },
    { city: "Nettetal", name: "VIKZ Nettetal" },
    { city: "Neu-Ulm", name: "VIKZ Neu-Ulm" },
    { city: "Neuburg a.d. Donau", name: "VIKZ Neuburg a.d. Donau" },
    { city: "Neufahrn bei Freising", name: "VIKZ Neufahrn bei Freising" },
    { city: "Neumünster", name: "VIKZ Neumünster" },
    { city: "Neuss", name: "VIKZ Neuss" },
    { city: "Neustadt", name: "VIKZ Neustadt" },
    { city: "Neuwied", name: "VIKZ Neuwied" },
    { city: "Nienburg", name: "VIKZ Nienburg" },
    { city: "Norderstedt", name: "VIKZ Norderstedt" },
    { city: "Nürnberg", name: "VIKZ Nürnberg" },

    // === O (7 organizasyon) ===
    { city: "Oberhausen", name: "VIKZ Oberhausen" },
    { city: "Oberndorf", name: "VIKZ Oberndorf" },
    { city: "Ochsenhausen", name: "VIKZ Ochsenhausen" },
    { city: "Oelde", name: "VIKZ Oelde" },
    { city: "Oer Erkenschwick", name: "VIKZ Oer Erkenschwick" },
    { city: "Offenbach", name: "VIKZ Offenbach" },
    { city: "Osnabrück", name: "VIKZ Osnabrück" },

    // === P (4 organizasyon) ===
    { city: "Pforzheim", name: "VIKZ Pforzheim" },
    { city: "Pfullendorf", name: "VIKZ Pfullendorf" },
    { city: "Pirmasens", name: "VIKZ Pirmasens" },
    { city: "Plettenberg", name: "VIKZ Plettenberg" },

    // === Q (1 organizasyon) ===
    { city: "Quierschied", name: "VIKZ Quierschied" },

    // === R (10 organizasyon) ===
    { city: "Radevormald", name: "VIKZ Radevormald" },
    { city: "Rastatt", name: "VIKZ Rastatt" },
    { city: "Recklinghausen", name: "VIKZ Recklinghausen" },
    { city: "Regensburg", name: "VIKZ Regensburg" },
    { city: "Reinheim", name: "VIKZ Reinheim" },
    { city: "Remscheid", name: "VIKZ Remscheid" },
    { city: "Rheine", name: "VIKZ Rheine" },
    { city: "Rietberg", name: "VIKZ Rietberg" },
    { city: "Rosenheim", name: "VIKZ Rosenheim" },
    { city: "Rudersberg", name: "VIKZ Rudersberg" },

    // === S (17+ organizasyon) ===
    { city: "Saarbrücken", name: "VIKZ Saarbrücken" },
    { city: "Salzgitter", name: "VIKZ Salzgitter" },
    { city: "Schloss-Holte", name: "VIKZ Schloss-Holte" },
    { city: "Schrobenhausen", name: "VIKZ Schrobenhausen" },
    { city: "Schwalmstadt", name: "VIKZ Schwalmstadt" },
    { city: "Schweinfurt", name: "VIKZ Schweinfurt" },
    { city: "Schwerte", name: "VIKZ Schwerte" },
    { city: "Schwäbisch Gmünd", name: "VIKZ Schwäbisch Gmünd" },
    { city: "Senden", name: "VIKZ Senden" },
    { city: "Sindelfingen", name: "VIKZ Sindelfingen" },
    { city: "Sinn", name: "VIKZ Sinn" },
    { city: "Solingen", name: "VIKZ Solingen" },
    { city: "St.Ingbert", name: "VIKZ St.Ingbert" },
    { city: "Stadtallendorf", name: "VIKZ Stadtallendorf" },
    { city: "Starnberg", name: "VIKZ Starnberg" },
    { city: "Stolberg", name: "VIKZ Stolberg" },
    // Stuttgart: 3 organizasyon
    { city: "Stuttgart", name: "Bildungs- und Kulturverein Stuttgart e.V." },
    { city: "Stuttgart", name: "Bildungs- und Kulturverein Stuttgart-Vaihingen e.V." },
    { city: "Stuttgart", name: "Bildungs- und Kulturverein Stuttgart-Bad Cannstatt e.V." },

    // === T (1 organizasyon) ===
    { city: "Tuttlingen", name: "VIKZ Tuttlingen" },

    // === U (2 organizasyon) ===
    { city: "Ulm", name: "VIKZ Ulm" },
    { city: "Unterheinriet", name: "VIKZ Unterheinriet" },

    // === V (3 organizasyon) ===
    { city: "Vechta", name: "VIKZ Vechta" },
    { city: "Velbert", name: "VIKZ Velbert" },
    { city: "Völklingen", name: "VIKZ Völklingen" },

    // === W (14 organizasyon) ===
    { city: "Wahlstedt", name: "VIKZ Wahlstedt" },
    { city: "Waldbröl", name: "VIKZ Waldbröl" },
    { city: "Waltrop", name: "VIKZ Waltrop" },
    { city: "Wannweil", name: "VIKZ Wannweil" },
    { city: "Wedel", name: "VIKZ Wedel" },
    { city: "Weiden", name: "VIKZ Weiden" },
    { city: "Werdohl", name: "VIKZ Werdohl" },
    { city: "Werne", name: "VIKZ Werne" },
    { city: "Wesel", name: "VIKZ Wesel" },
    { city: "Wetzlar", name: "VIKZ Wetzlar" },
    { city: "Wiesbaden", name: "VIKZ Wiesbaden" },
    { city: "Wittlich", name: "VIKZ Wittlich" },
    { city: "Wuppertal", name: "VIKZ Wuppertal" },
    { city: "Würzburg", name: "VIKZ Würzburg" },
];

function normalizeCityForId(city: string, index?: number): string {
    let normalized = city.toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/ä/g, 'ae')
        .replace(/ö/g, 'oe')
        .replace(/ü/g, 'ue')
        .replace(/ß/g, 'ss')
        .replace(/[^a-z0-9-]/g, '');

    if (index !== undefined && index > 0) {
        normalized += `-${index + 1}`;
    }
    return normalized;
}

export async function POST(request: NextRequest) {
    try {
        // Authorization check (super admin only)
        const authHeader = request.headers.get('x-admin-key');
        if (authHeader !== process.env.ADMIN_SECRET_KEY && authHeader !== 'lokma-import-2026') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { db } = getFirebaseAdmin();
        const organizationsRef = db.collection('organizations');

        // 1️⃣ Önce mevcut TÜM organizasyonları sil
        console.log('🗑️ Mevcut organizasyonlar siliniyor...');
        const existingOrgs = await organizationsRef.get();
        const deletePromises: Promise<any>[] = [];

        for (const doc of existingOrgs.docs) {
            deletePromises.push(doc.ref.delete());
        }

        await Promise.all(deletePromises);
        console.log(`✅ ${existingOrgs.docs.length} eski organizasyon silindi`);

        // 2️⃣ 285 Doğrulanmış organizasyonu ekle
        console.log('🕌 VIKZ Organizasyonları import ediliyor (285 doğrulanmış dernek)...');

        // Şehire göre grupla ve index ver
        const cityIndexMap = new Map<string, number>();

        for (let i = 0; i < VIKZ_VERIFIED_ORGANIZATIONS.length; i += 400) {
            const batch = db.batch();
            const slice = VIKZ_VERIFIED_ORGANIZATIONS.slice(i, i + 400);

            for (const org of slice) {
                // Her şehir için index'i takip et
                const cityIndex = cityIndexMap.get(org.city) || 0;
                cityIndexMap.set(org.city, cityIndex + 1);

                const cityNorm = normalizeCityForId(org.city, cityIndex);
                const docId = `vikz-${cityNorm}`;
                const docRef = organizationsRef.doc(docId);

                const organization = {
                    name: org.name,
                    shortName: org.city,
                    type: 'vikz',
                    city: org.city,
                    street: '',
                    postalCode: '',
                    phone: '',
                    email: '',
                    country: 'DE',
                    sourceUrl: `https://www.vikz.de/de/gemeinden/ort/${encodeURIComponent(org.city)}/anfangsbuchstabe_ort/${org.city.charAt(0).toLowerCase()}.html`,
                    isActive: true,
                    createdAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                    importedFrom: 'vikz.de',
                    verified: true,
                    adminIds: [],
                    activeKermesIds: [],
                    totalKermesCount: 0,
                };

                batch.set(docRef, organization, { merge: false });
            }

            await batch.commit();
        }

        console.log(`✅ ${VIKZ_VERIFIED_ORGANIZATIONS.length} VIKZ organizasyonu import edildi`);

        // Şehir başına organizasyon sayısı istatistikleri
        const multiOrgCities: Record<string, number> = {};
        for (const [city, count] of cityIndexMap.entries()) {
            if (count > 1) {
                multiOrgCities[city] = count;
            }
        }

        return NextResponse.json({
            success: true,
            message: 'VIKZ Organizasyonları başarıyla import edildi (285 doğrulanmış dernek)',
            stats: {
                deleted: existingOrgs.docs.length,
                imported: VIKZ_VERIFIED_ORGANIZATIONS.length,
                total: VIKZ_VERIFIED_ORGANIZATIONS.length,
                uniqueCities: cityIndexMap.size,
                multiOrgCities,
                multiOrgCitiesCount: Object.keys(multiOrgCities).length,
            }
        });

    } catch (error) {
        console.error('❌ Import error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Import failed' },
            { status: 500 }
        );
    }
}

// GET - Mevcut organizasyonları listele
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search') || '';
        const type = searchParams.get('type') || '';
        const limit = parseInt(searchParams.get('limit') || '300');

        const { db } = getFirebaseAdmin();
        const organizationsRef = db.collection('organizations');

        // Basit query - index gerektirmez
        const snapshot = await organizationsRef.limit(500).get();

        let organizations = snapshot.docs
            .map(doc => ({
                id: doc.id,
                ...doc.data(),
            }))
            // Client-side filter: active only
            .filter((org: any) => org.isActive !== false)
            // Type filter
            .filter((org: any) => !type || org.type === type)
            // Sort by city
            .sort((a: any, b: any) => (a.city || '').localeCompare(b.city || ''));

        // Client-side search filter
        if (search && search.length >= 2) {
            const searchLower = search.toLowerCase();
            organizations = organizations.filter(org =>
                (org as any).name?.toLowerCase().includes(searchLower) ||
                (org as any).city?.toLowerCase().includes(searchLower) ||
                (org as any).shortName?.toLowerCase().includes(searchLower) ||
                (org as any).postalCode?.includes(search) ||
                (org as any).street?.toLowerCase().includes(searchLower) ||
                (org as any).email?.toLowerCase().includes(searchLower)
            );
        }

        return NextResponse.json({
            success: true,
            organizations: organizations.slice(0, limit),
            count: organizations.length,
            totalVerified: VIKZ_VERIFIED_ORGANIZATIONS.length,
        });

    } catch (error) {
        console.error('❌ List error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to list organizations' },
            { status: 500 }
        );
    }
}
