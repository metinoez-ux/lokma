const fs = require('fs');
const file = 'admin_portal/src/app/[locale]/admin/kermes/[id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `      const [snapUsers, snapAdmins] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'admins')),
      ]);

      const allUsers = new Map<string, any>();
      snapAdmins.docs.forEach(d => allUsers.set(d.id, { id: d.id, _src: 'admin', ...d.data() }));
      snapUsers.docs.forEach(d => {
        if (!allUsers.has(d.id)) allUsers.set(d.id, { id: d.id, _src: 'user', ...d.data() });
      });`;

const replacement = `      const checks = [
        getDocs(collection(db, 'admins'))
      ];

      // Sadece 3 karakter ve uzeri ise users'da isimle arama yapalim, 
      // butun users koleksiyonunu indirmek cok tehlikeli
      if (q.length >= 3) {
        const qCap = q.charAt(0).toUpperCase() + q.slice(1);
        checks.push(
          getDocs(query(collection(db, 'users'), where('name', '>=', qCap), where('name', '<=', qCap + '\\uf8ff'), limit(10))),
          getDocs(query(collection(db, 'users'), where('name', '>=', q), where('name', '<=', q + '\\uf8ff'), limit(10))),
          getDocs(query(collection(db, 'users'), where('firstName', '>=', qCap), where('firstName', '<=', qCap + '\\uf8ff'), limit(10))),
          getDocs(query(collection(db, 'users'), where('firstName', '>=', q), where('firstName', '<=', q + '\\uf8ff'), limit(10)))
        );
      }

      const snapshots = await Promise.all(checks);

      const allUsers = new Map<string, any>();
      
      // Admins (ilk sonuc)
      snapshots[0].docs.forEach((d: any) => allUsers.set(d.id, { id: d.id, _src: 'admin', ...d.data() }));
      
      // Users (diger sonuclar)
      for (let i = 1; i < snapshots.length; i++) {
        snapshots[i].docs.forEach((d: any) => {
          if (!allUsers.has(d.id)) allUsers.set(d.id, { id: d.id, _src: 'user', ...d.data() });
        });
      }`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(file, content);
  console.log("Success exact match");
} else {
  // try regex or replacing parts
  console.log("Exact match failed, doing regex...");
  let rx = /const\s+\[snapUsers,\s*snapAdmins\]\s*=\s*await\s+Promise\.all\(\[\s*getDocs\(collection\(db,\s*'users'\)\),\s*getDocs\(collection\(db,\s*'admins'\)\),\s*\]\);\s*const\s+allUsers\s*=\s*new\s+Map<string,\s*any>\(\);\s*snapAdmins\.docs\.forEach\(d\s*=>\s*allUsers\.set\(d\.id,\s*\{\s*id:\s*d\.id,\s*_src:\s*'admin',\s*\.\.\.d\.data\(\)\s*\}\)\);\s*snapUsers\.docs\.forEach\(d\s*=>\s*\{\s*if\s*\(!allUsers\.has\(d\.id\)\)\s*allUsers\.set\(d\.id,\s*\{\s*id:\s*d\.id,\s*_src:\s*'user',\s*\.\.\.d\.data\(\)\s*\}\);\s*\}\);/m;
  if (rx.test(content)) {
    content = content.replace(rx, replacement);
    fs.writeFileSync(file, content);
    console.log("Success regex match");
  } else {
    console.log("Regex match also failed");
  }
}
