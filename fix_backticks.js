const fs = require('fs');
const path = require('path');

function walk(dir) {
  const results = [];
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) results.push(...walk(full));
    else if (f.endsWith('.ts')) results.push(full);
  }
  return results;
}

const dir = 'C:/Users/SAM/Desktop/chesscoin/backend/src';
let fixed = 0;
const BACKSLASH_BACKTICK = '\x5c\x60';   // \`
const BACKSLASH_DOLLAR = '\x5c\x24\x7b'; // \${

for (const f of walk(dir)) {
  let content = fs.readFileSync(f, 'utf8');
  const orig = content;
  content = content.split(BACKSLASH_BACKTICK).join('\x60');   // replace \` with `
  content = content.split(BACKSLASH_DOLLAR).join('\x24\x7b'); // replace \${ with ${
  if (content !== orig) {
    fs.writeFileSync(f, content, 'utf8');
    fixed++;
    console.log('Fixed: ' + path.basename(f));
  }
}
console.log('Total files fixed: ' + fixed);
