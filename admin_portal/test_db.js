const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function run() {
  const docRef = db.collection('settings').doc('kermes_roles');
  const doc = await docRef.get();
  if (!doc.exists) {
    console.log('Document does not exist. Creating default...');
    await docRef.set({
      systemRoles: [
        { id: 'system_staff', name: 'Genel Personel', icon: '👥', color: 'bg-slate-100 text-slate-800 dark:bg-slate-900/50 dark:text-slate-300', systemRoleKey: 'assignedStaff', description: 'Temel giriş yetkisi ve kermes listesini görme' },
        { id: 'system_driver', name: 'Sürücü / Kurye', icon: '🚗', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300', systemRoleKey: 'assignedDrivers', description: 'Siparişleri teslim etme yetkisi' },
        { id: 'system_waiter', name: 'Garson', icon: '🍽️', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300', systemRoleKey: 'assignedWaiters', description: 'Masalara servis yapma yetkisi' },
        { id: 'system_admin', name: 'Kermes Admin', icon: '👑', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300', systemRoleKey: 'kermesAdmins', description: 'Kermesi yönetme tam yetkisi' },
        { id: 'extended_temizlik', name: 'Temizlik Görevlisi', icon: '🧹', color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300', description: 'Etkinlik alanı temizliği ve düzeni' },
        { id: 'extended_park', name: 'Park Görevlisi', icon: '🅿️', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', description: 'Araç park yönlendirme ve düzeni' },
        { id: 'extended_cocuk', name: 'Çocuk Görevlisi', icon: '👶', color: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300', description: 'Çocuk oyun alanı gözetimi' },
        { id: 'extended_vip', name: 'Özel Misafir (VIP)', icon: '⭐', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', description: 'Protokol ve özel misafir ağırlama' },
        { id: 'extended_tedarik', name: 'Malzeme Tedarikçisi', icon: '📦', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300', description: 'Malzeme ve lojistik tedariği' }
      ]
    });
    console.log('Created default settings/kermes_roles');
  } else {
    console.log('Document already exists:', doc.data());
  }
}

run().catch(console.error);
