const fs = require('fs');
const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/kermes/[id]/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

const loadKermesModification = `
      // Load global system roles
      const settingsSnap = await getDoc(doc(db, 'settings', 'kermes_roles'));
      if (settingsSnap.exists()) {
        const sr = settingsSnap.data().systemRoles;
        if (sr && Array.isArray(sr)) {
          setGlobalSystemRoles(sr);
        } else {
          setGlobalSystemRoles(DEFAULT_GLOBAL_SYSTEM_ROLES);
        }
      } else {
        // If it doesn't exist, create it!
        setGlobalSystemRoles(DEFAULT_GLOBAL_SYSTEM_ROLES);
        await setDoc(doc(db, 'settings', 'kermes_roles'), { systemRoles: DEFAULT_GLOBAL_SYSTEM_ROLES });
      }
`;

// Inject into loadKermes after setKermes
txt = txt.replace('setKermes(data);', 'setKermes(data);\n' + loadKermesModification);

// Also remove the old legacy logic where we pushed default roles to customRoles
const removePattern = /customRoles: \(\(\) => \{[\s\S]*?\}\)\(\),/;
txt = txt.replace(removePattern, `customRoles: (data.customRoles || []),`);

fs.writeFileSync(file, txt);
console.log('loadKermes updated');
