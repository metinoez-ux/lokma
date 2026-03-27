const fs = require('fs');
const files = fs.readdirSync('messages').filter(f => f.endsWith('.json'));
for (let f of files) {
  try {
    const raw = fs.readFileSync('messages/' + f, 'utf8');
    JSON.parse(raw);
    console.log(f + " OK");
  } catch(e) {
    console.log(f + " ERROR: " + e.message);
  }
}
