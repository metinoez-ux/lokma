import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = 'https://lokma.shop';

    // Define available locales
    const locales = ['tr', 'de', 'en', 'fr', 'it', 'es', 'nl'];

    // Define core public routes
    const routes = [
        '',
        '/about',
        '/how-it-works',
        '/ciftciden',
        '/partner',
        '/kurye', // New Route
        '/contact',
        '/categories',
        '/el-lezzetleri',
        '/impressum', // New Legal
        '/datenschutz', // New Legal
        '/agb', // New Legal
        '/widerruf', // New Legal
    ];

    // Generate sitemap entries for all combinations of routes and locales
    const sitemapEntries: MetadataRoute.Sitemap = [];

    routes.forEach((route) => {
        locales.forEach((locale) => {
            sitemapEntries.push({
                url: `${baseUrl}/${locale}${route}`,
                lastModified: new Date(),
                changeFrequency: route === '' ? 'daily' : 'weekly',
                priority: route === '' ? 1 : 0.8,
            });
        });
    });

    return sitemapEntries;
}
