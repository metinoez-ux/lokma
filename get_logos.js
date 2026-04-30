const https = require('https');

function fetchOgImage(urlStr) {
    return new Promise((resolve) => {
        https.get(urlStr, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const ogMatch = data.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
                if (ogMatch) return resolve(ogMatch[1]);
                
                const logoMatch = data.match(/<img[^>]*class="[^"]*logo[^"]*"[^>]*src="([^"]+)"/i) 
                               || data.match(/<img[^>]*src="([^"]*logo[^"]*)"/i);
                if (logoMatch) {
                    let src = logoMatch[1];
                    if (src.startsWith('/')) {
                        const urlObj = new URL(urlStr);
                        src = urlObj.origin + src;
                    }
                    return resolve(src);
                }
                resolve(null);
            });
        }).on('error', () => resolve(null));
    });
}

const urls = [
    'https://mana.org.tr/',
    'https://iladernegi.org/',
    'https://www.diversitydernegi.org/',
    'https://serhat.org/',
    'https://ilaeurope.de/',
    'https://dr-sahin.help/'
];

async function run() {
    for (const u of urls) {
        console.log(u, await fetchOgImage(u));
    }
}
run();
