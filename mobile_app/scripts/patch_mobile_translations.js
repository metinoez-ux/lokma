const fs = require('fs');
const path = require('path');

const locales = ['de', 'en', 'es', 'fr', 'it', 'nl', 'tr'];
const dir = path.join(__dirname, '../assets/translations');

const translations = {
    tr: { 
        email_veya_telefon: "E-Posta veya Telefon", 
        sms_ile_sifresiz_giris: "Şifreniz yok mu? SMS Kodu ile Giriş" 
    },
    de: { 
        email_veya_telefon: "E-Mail oder Telefon", 
        sms_ile_sifresiz_giris: "Kein Passwort? Mit SMS-Code einloggen" 
    },
    en: { 
        email_veya_telefon: "Email or Phone", 
        sms_ile_sifresiz_giris: "No password? Login with SMS Code" 
    },
    es: { 
        email_veya_telefon: "Correo o Teléfono", 
        sms_ile_sifresiz_giris: "¿Sin contraseña? Iniciar con código SMS" 
    },
    fr: { 
        email_veya_telefon: "E-mail ou Téléphone", 
        sms_ile_sifresiz_giris: "Pas de mot de passe ? Connexion via SMS" 
    },
    it: { 
        email_veya_telefon: "Email o Telefono", 
        sms_ile_sifresiz_giris: "Niente password? Accedi con SMS" 
    },
    nl: { 
        email_veya_telefon: "E-mail of Telefoon", 
        sms_ile_sifresiz_giris: "Geen wachtwoord? Inloggen met SMS" 
    }
};

for (const loc of locales) {
    const file = path.join(dir, `${loc}.json`);
    if (fs.existsSync(file)) {
        const raw = fs.readFileSync(file, 'utf8');
        const json = JSON.parse(raw);
        if (json.auth) {
            let patched = false;
            for (const [key, value] of Object.entries(translations[loc])) {
                if (!json.auth[key]) {
                    json.auth[key] = value;
                    patched = true;
                }
            }
            if (patched) {
                fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
                console.log(`✅ Patched ${loc}.json`);
            }
        }
    }
}
