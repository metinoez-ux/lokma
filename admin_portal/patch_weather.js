const fs = require('fs');
const p = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/kermes-tv/[kermesId]/page.tsx';
let d = fs.readFileSync(p, 'utf8');

// 1. Weather Data Types and icon helper
if (!d.includes('function getWeatherIcon(code: number)')) {
    d = d.replace(/export default function KermesTvPage/, `
interface WeatherData {
  temp: number;
  wind: number;
  prob: number;
  code: number;
}

function getWeatherIcon(code: number) {
  if (code === 0) return 'sunny';
  if ([1, 2, 3].includes(code)) return 'partly_cloudy_day';
  if ([45, 48].includes(code)) return 'foggy';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snowing';
  if ([95, 96, 99].includes(code)) return 'thunderstorm';
  return 'rainy';
}

export default function KermesTvPage`);
}

// 2. Weather State
if (!d.includes('const [weather, setWeather]')) {
    d = d.replace(/const \[activeDeliveryZone, setActiveDeliveryZone\] = useState<any>\(null\);/,
    "const [activeDeliveryZone, setActiveDeliveryZone] = useState<any>(null);\n  const [weather, setWeather] = useState<WeatherData | null>(null);");
}

// 3. Web Fetch Logic in fetchKermesMeta
if (!d.includes('fetchWeather(')) {
    const fetchLogic = `
          // Weather fetch
          const fetchWeather = async (lat: number, lng: number) => {
            try {
              const res = await fetch(\`https://api.open-meteo.com/v1/forecast?latitude=\${lat}&longitude=\${lng}&current=temperature_2m,wind_speed_10m,weather_code&hourly=precipitation_probability\`);
              const wData = await res.json();
              if (wData.current) {
                setWeather({
                  temp: Math.round(wData.current.temperature_2m),
                  wind: Math.round(wData.current.wind_speed_10m),
                  prob: wData.hourly?.precipitation_probability?.[new Date().getHours()] || 0,
                  code: wData.current.weather_code
                });
              }
            } catch (e) { console.error('Hava durumu cekilemedi', e); }
          };

          const loc = data.city || data.location;
          if (loc) {
             const geoRes = await fetch(\`https://geocoding-api.open-meteo.com/v1/search?name=\${encodeURIComponent(loc)}&count=1\`);
             const geoData = await geoRes.json();
             if (geoData.results?.length > 0) {
               fetchWeather(geoData.results[0].latitude, geoData.results[0].longitude);
             } else {
               fetchWeather(51.1657, 10.4515); // Germany
             }
          } else {
             fetchWeather(51.1657, 10.4515); // Germany Fallback
          }
`;
    // Insert after setKermesName(data.name || data.title || 'Kermes');
    d = d.replace(/setKermesName\(data\.name \|\| data\.title \|\| 'Kermes'\);/,
    "setKermesName(data.name || data.title || 'Kermes');\n" + fetchLogic);
}

// 4. LOKMA -> LOKMA ODS
d = d.replace(/<span className=\{styles\.lokmaLogo\}>LOKMA<\/span>/, 
    '<span className={styles.lokmaLogo}>LOKMA ODS</span>');


// 5. Header middle
const weatherUI = `
          <div className={styles.headerCenter} style={{flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
            {weather ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(255, 255, 255, 0.05)', padding: '6px 20px', borderRadius: '50px', border: '1px solid rgba(255,255,255,0.1)' }}>
                 <div style={{display: 'flex', alignItems: 'center', gap: '6px', color: '#fff'}}>
                    <span className="material-symbols-outlined" style={{color: '#fbbf24', fontSize: '24px'}}>{getWeatherIcon(weather.code)}</span>
                    <span style={{fontSize: '20px', fontWeight: 'bold'}}>{weather.temp}°C</span>
                 </div>
                 <div style={{width: '2px', height: '20px', background: 'rgba(255,255,255,0.2)'}}></div>
                 <div style={{display: 'flex', alignItems: 'center', gap: '6px', color: '#cbd5e1'}}>
                    <span className="material-symbols-outlined" style={{fontSize: '20px'}}>air</span>
                    <span style={{fontSize: '18px', fontWeight: '500'}}>{weather.wind} km/h</span>
                 </div>
                 <div style={{width: '2px', height: '20px', background: 'rgba(255,255,255,0.2)'}}></div>
                 <div style={{display: 'flex', alignItems: 'center', gap: '6px', color: '#93c5fd'}}>
                    <span className="material-symbols-outlined" style={{fontSize: '20px'}}>water_drop</span>
                    <span style={{fontSize: '18px', fontWeight: '500'}}>%{weather.prob}</span>
                 </div>
              </div>
            ) : null}
            {displayTitle && (
              <span className={styles.sectionBadge} style={{marginLeft: weather ? '16px' : '0'}}>{displayTitle}</span>
            )}
          </div>
`;

if (!d.includes('%{weather.prob}')) {
    d = d.replace(/<div className=\{styles\.headerCenter\}>[\s\S]*?<\/div>/, weatherUI);
}

fs.writeFileSync(p, d);
console.log("Patched TV screen successfully");
