const fs = require('fs');
const path = require('path');

const messagesDir = path.join(__dirname, 'messages');
const files = fs.readdirSync(messagesDir).filter(f => f.endsWith('.json'));

for (const file of files) {
    const filePath = path.join(messagesDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(content);

    // AdminNav and globals
    if (json.AdminNav) {
        if (file === 'tr.json') json.AdminNav.activityLogs = 'Servis';
        else if (file === 'en.json') json.AdminNav.activityLogs = 'Customer Service';
        else if (file === 'de.json') json.AdminNav.activityLogs = 'Kundenservice';
        else json.AdminNav.activityLogs = 'Customer Service';
    }

    // Add AdminCustomerService namespace
    if (file === 'tr.json') {
        json.AdminCustomerService = {
            "title": "Müşteri Hizmetleri",
            "subtitle": "Kullanıcıları, siparişleri, telefon numaralarını ve daha fazlasını tek bir yerden arayın.",
            "search_placeholder": "İsim, E-posta, Telefon (+49...), Sipariş ID, Posta Kodu...",
            "search_button": "Ara",
            "users_found": "Kullanıcılar Bulundu",
            "orders_found": "Siparişler Bulundu",
            "no_results": "Sonuç bulunamadı. Lütfen aramanızı genişletin.",
            "search_to_start": "Aramak için yukarıya bir değer girin.",
            "searching": "Aranıyor...",
            "date_filter_all": "Tüm Zamanlar",
            "date_filter_today": "Bugün",
            "date_filter_yesterday": "Dün",
            "date_filter_last7days": "Son 7 Gün",
            "date_filter_thisMonth": "Bu Ay",
            "date_filter_thisYear": "Bu Sene",
            "date_filter_years": "Yıllar",
            "user_card": {
                "role": "Rol",
                "phone": "Telefon",
                "email": "E-posta",
                "registered": "Kayıt",
                "app_lang": "Uygulama Dili"
            },
            "order_card": {
                "status": "Durum",
                "total": "Tutar",
                "customer": "Müşteri",
                "business": "İşletme",
                "type": "Tür",
                "address": "Adres",
                "date": "Tarih"
            }
        };
    } else {
        json.AdminCustomerService = {
            "title": "Customer Service",
            "subtitle": "Search users, orders, phone numbers and more from a single place.",
            "search_placeholder": "Name, Email, Phone (+49...), Order ID, Zip Code...",
            "search_button": "Search",
            "users_found": "Users Found",
            "orders_found": "Orders Found",
            "no_results": "No results found. Try expanding your search.",
            "search_to_start": "Enter a value above to start searching.",
            "searching": "Searching...",
            "date_filter_all": "All Time",
            "date_filter_today": "Today",
            "date_filter_yesterday": "Yesterday",
            "date_filter_last7days": "Last 7 Days",
            "date_filter_thisMonth": "This Month",
            "date_filter_thisYear": "This Year",
            "date_filter_years": "Years",
            "user_card": {
                "role": "Role",
                "phone": "Phone",
                "email": "Email",
                "registered": "Registered",
                "app_lang": "App Lang"
            },
            "order_card": {
                "status": "Status",
                "total": "Total",
                "customer": "Customer",
                "business": "Business",
                "type": "Type",
                "address": "Address",
                "date": "Date"
            }
        };
    }

    fs.writeFileSync(filePath, JSON.stringify(json, null, 4));
}
console.log('Translations updated for Customer Service.');
