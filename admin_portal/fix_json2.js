const fs = require('fs');
const files = fs.readdirSync('./messages').filter(f => f.endsWith('.json'));
for(const f of files) {
   let text = fs.readFileSync('./messages/'+f, 'utf8');
   text += '}\n';
   fs.writeFileSync('./messages/'+f, text);
}
