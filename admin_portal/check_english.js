const fs = require('fs');
const fr = require('./messages/fr.json');
const landing = fr.Landing;
for (const key in landing) {
  console.log(`${key}: ${landing[key]}`);
}
