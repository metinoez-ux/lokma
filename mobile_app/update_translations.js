const fs = require('fs');
const path = require('path');

const locales = ['tr', 'en', 'de', 'es', 'fr', 'it', 'nl'];
const dir = '/Users/metinoz/.gemini/antigravity/scratch/LOKMA_2026/mobile_app/assets/translations';

const newKeys = {
  tr: {
    "rate_business_title": "İşletmeyi Puanla",
    "how_was_food": "Yemek nasıldı? {}",
    "help_improve_service": "Herkesin daha iyi hizmet almasına yardımcı olun.",
    "courier_experience": "Kurye Deneyimi",
    "pickup_experience": "Gel Al Deneyimi",
    "experience_bad": "Kötü",
    "experience_ok": "İdare Eder",
    "experience_great": "Harika",
    "write_comment": "Yorum Yazın",
    "optional_length": "İsteğe bağlı - {}/255",
    "comment_hint_completed": "Yemek lezzetli miydi? İyi paketlendi mi? Bize bildirin...",
    "comment_hint_not_completed": "Sipariş tamamlandıktan sonra yorum yapabilirsiniz...",
    "submit_rating": "Gönder",
    "after_order_completed": "Sipariş Tamamlandıktan Sonra"
  },
  en: {
    "rate_business_title": "Rate Business",
    "how_was_food": "How was the food? {}",
    "help_improve_service": "Help everyone get better service.",
    "courier_experience": "Courier Experience",
    "pickup_experience": "Pickup Experience",
    "experience_bad": "Bad",
    "experience_ok": "OK",
    "experience_great": "Great",
    "write_comment": "Write a Comment",
    "optional_length": "Optional - {}/255",
    "comment_hint_completed": "Was the food delicious? Was it packed well? Let us know...",
    "comment_hint_not_completed": "You can leave a comment after the order is completed...",
    "submit_rating": "Submit",
    "after_order_completed": "After Order Completed"
  },
  de: {
    "rate_business_title": "Restaurant bewerten",
    "how_was_food": "Wie war das Essen? {}",
    "help_improve_service": "Helfen Sie allen, einen besseren Service zu erhalten.",
    "courier_experience": "Kurier-Erfahrung",
    "pickup_experience": "Abhol-Erfahrung",
    "experience_bad": "Schlecht",
    "experience_ok": "Okay",
    "experience_great": "Super",
    "write_comment": "Kommentar schreiben",
    "optional_length": "Optional - {}/255",
    "comment_hint_completed": "War das Essen lecker? Gut verpackt? Lassen Sie es uns wissen...",
    "comment_hint_not_completed": "Sie können einen Kommentar hinterlassen, wenn die Bestellung abgeschlossen ist...",
    "submit_rating": "Senden",
    "after_order_completed": "Nach Abschluss der Bestellung"
  },
  es: {
    "rate_business_title": "Calificar restaurante",
    "how_was_food": "¿Qué tal la comida? {}",
    "help_improve_service": "Ayuda a todos a tener un mejor servicio.",
    "courier_experience": "Experiencia con el mensajero",
    "pickup_experience": "Experiencia de recogida",
    "experience_bad": "Mala",
    "experience_ok": "Regular",
    "experience_great": "Genial",
    "write_comment": "Escribe un comentario",
    "optional_length": "Opcional - {}/255",
    "comment_hint_completed": "¿Estaba deliciosa la comida? ¿Bien empaquetada? Cuéntanos...",
    "comment_hint_not_completed": "Puedes dejar un comentario cuando el pedido esté completado...",
    "submit_rating": "Enviar",
    "after_order_completed": "Tras completar el pedido"
  },
  fr: {
    "rate_business_title": "Évaluer le restaurant",
    "how_was_food": "Comment était le repas ? {}",
    "help_improve_service": "Aidez tout le monde à obtenir un meilleur service.",
    "courier_experience": "Expérience coursier",
    "pickup_experience": "Expérience à emporter",
    "experience_bad": "Mauvais",
    "experience_ok": "Moyen",
    "experience_great": "Super",
    "write_comment": "Laisser un commentaire",
    "optional_length": "Optionnel - {}/255",
    "comment_hint_completed": "Le repas était-il délicieux ? Bien emballé ? Dites-nous tout...",
    "comment_hint_not_completed": "Vous pourrez laisser un commentaire une fois la commande terminée...",
    "submit_rating": "Envoyer",
    "after_order_completed": "Une fois la commande terminée"
  },
  it: {
    "rate_business_title": "Valuta il ristorante",
    "how_was_food": "Com'era il cibo? {}",
    "help_improve_service": "Aiuta tutti a ricevere un servizio migliore.",
    "courier_experience": "Esperienza corriere",
    "pickup_experience": "Esperienza ritiro",
    "experience_bad": "Pessima",
    "experience_ok": "Discreta",
    "experience_great": "Ottima",
    "write_comment": "Scrivi un commento",
    "optional_length": "Opzionale - {}/255",
    "comment_hint_completed": "Il cibo era delizioso? Era imballato bene? Facci sapere...",
    "comment_hint_not_completed": "Potrai lasciare un commento quando l'ordine sarà completato...",
    "submit_rating": "Invia",
    "after_order_completed": "A ordine completato"
  },
  nl: {
    "rate_business_title": "Beoordeel restaurant",
    "how_was_food": "Hoe was het eten? {}",
    "help_improve_service": "Help iedereen om een betere service te krijgen.",
    "courier_experience": "Koerier ervaring",
    "pickup_experience": "Afhaal ervaring",
    "experience_bad": "Slecht",
    "experience_ok": "Matig",
    "experience_great": "Geweldig",
    "write_comment": "Schrijf een reactie",
    "optional_length": "Optioneel - {}/255",
    "comment_hint_completed": "Was het eten lekker? Goed verpakt? Laat het ons weten...",
    "comment_hint_not_completed": "Je kunt een reactie achterlaten zodra de bestelling is afgerond...",
    "submit_rating": "Verzenden",
    "after_order_completed": "Na afronding bestelling"
  }
};

for (const lang of locales) {
  const filePath = path.join(dir, `${lang}.json`);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    continue;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(content);
  
  if (!data.orders) {
    data.orders = {};
  }
  
  Object.assign(data.orders, newKeys[lang]);
  
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`Updated ${lang}.json`);
}
