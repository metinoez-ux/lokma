const fs = require('fs');
const files = [
  'src/components/OrderListener.tsx',
  'src/hooks/useOrders.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('onSnapshot(')) {
      // Find the closing bracket.
      let openBrackets = 0;
      let openParentheses = 0;
      let j = i;
      let foundEnd = false;
      for (; j < lines.length; j++) {
        for (let k = 0; k < lines[j].length; k++) {
          if (lines[j][k] === '(') openParentheses++;
          if (lines[j][k] === ')') openParentheses--;
          if (lines[j][k] === '{') openBrackets++;
          if (lines[j][k] === '}') openBrackets--;
          if (openParentheses === 0 && openBrackets === 0 && j > i) {
            foundEnd = true;
            // check if the line already ends with an error handler
            if (!lines[j].includes('console.error')) {
               lines[j] = lines[j].replace('});', '}, (err) => { console.error("Firestore onSnapshot Error:", err); });');
            }
            break;
          }
        }
        if (foundEnd) break;
      }
    }
  }
  fs.writeFileSync(file, lines.join('\n'));
}
console.log('Fixed onSnapshot calls.');
