const fs = require('fs');
const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/kermes/[id]/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

const typesStr = `
export interface GlobalSystemRole {
  id: string; // e.g. role_staff, role_driver, role_waiter, extended_temizlik
  name: string;
  icon: string;
  color: string;
  description: string;
  isCore?: boolean; // If true, it is essential to the system (like assignedDrivers) and cannot be deleted.
}

export const DEFAULT_GLOBAL_SYSTEM_ROLES: GlobalSystemRole[] = [
  { id: 'role_staff', name: 'Genel Personel', icon: '👥', color: 'bg-slate-100 text-slate-800 dark:bg-slate-900/50 dark:text-slate-300', description: 'Temel giriş yetkisi ve kermes listesini görme', isCore: true },
  { id: 'role_driver', name: 'Sürücü / Kurye', icon: '🚗', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300', description: 'Siparişleri teslim etme yetkisi', isCore: true },
  { id: 'role_waiter', name: 'Garson', icon: '🍽️', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300', description: 'Masalara servis yapma yetkisi', isCore: true },
  { id: 'role_admin', name: 'Kermes Admin', icon: '👑', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300', description: 'Kermesi yönetme tam yetkisi', isCore: true },
  { id: 'role_temizlik_system', name: 'Temizlik Görevlisi', icon: '🧹', color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300', description: 'Etkinlik alanı temizliği ve düzeni' },
  { id: 'role_park_system', name: 'Park Görevlisi', icon: '🅿️', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', description: 'Araç park yönlendirme ve düzeni' },
  { id: 'role_cocuk_system', name: 'Çocuk Görevlisi', icon: '👶', color: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300', description: 'Çocuk oyun alanı gözetimi' },
  { id: 'role_vip_system', name: 'Özel Misafir (VIP)', icon: '⭐', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', description: 'Protokol ve özel misafir ağırlama' },
  { id: 'role_tedarik_system', name: 'Malzeme Tedarikçisi', icon: '📦', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300', description: 'Malzeme ve lojistik tedariği' }
];
`;

txt = txt.replace('export interface KermesCustomRole {', typesStr + '\nexport interface KermesCustomRole {');

// Add globalSystemRoles state state
const stateStr = `
  const [globalSystemRoles, setGlobalSystemRoles] = useState<GlobalSystemRole[]>([]);
  const [editingGlobalRole, setEditingGlobalRole] = useState<GlobalSystemRole | null>(null);
`;
txt = txt.replace('const [customRoleAssignments, setCustomRoleAssignments] = useState<Record<string, string[]>>({});', 'const [customRoleAssignments, setCustomRoleAssignments] = useState<Record<string, string[]>>({});\n' + stateStr);

fs.writeFileSync(file, txt);
console.log('Types and State added.');
